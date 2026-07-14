# Infrastructure Design Document
## FlowForge — Cloud Infrastructure on AWS

---

## Overview

This document describes the target production infrastructure for FlowForge deployed on AWS. It covers service topology, networking, scaling strategy, observability, and cost trade-offs.

---

## System Topology Diagram

```
                         ┌────────────────────────────────────┐
                         │       CloudFront (CDN)              │
                         │  + S3 Bucket (React Static Files)   │
                         └─────────────────┬──────────────────┘
                                           │ HTTPS
                         ┌─────────────────▼──────────────────┐
                         │         Application Load Balancer    │
                         │         (ALB — Multi-AZ)            │
                         └───────────────┬────────────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                     │
        ┌───────────▼────────┐ ┌─────────▼──────────┐        │
        │  ECS Fargate (API)  │ │ ECS Fargate (Worker)│       │
        │  NestJS — 2 tasks   │ │  BullMQ Consumer    │       │
        │  CPU: 512, Mem: 1GB │ │  CPU: 256, Mem: 512 │       │
        │  Auto-scale by CPU  │ │  Auto-scale by      │       │
        └────────┬────────────┘ │  queue depth        │       │
                 │              └──────────┬───────────┘       │
                 │                         │                   │
     ┌───────────▼─────────────────────────▼──────────────┐   │
     │              Internal VPC (Private Subnet)          │   │
     │                                                     │   │
     │  ┌─────────────────────┐  ┌─────────────────────┐  │   │
     │  │ RDS PostgreSQL      │  │  ElastiCache Redis   │  │   │
     │  │ (Multi-AZ, gp3)     │  │  (Cluster mode off,  │  │   │
     │  │  db.t3.medium        │  │   cache.t3.micro)    │  │   │
     │  └─────────────────────┘  └─────────────────────┘  │   │
     │                                                     │   │
     │  ┌─────────────────────────────────────────────┐   │   │
     │  │  MongoDB Atlas (M10 — dedicated cluster)      │   │   │
     │  │  (or AWS DocumentDB for full-AWS setup)       │   │   │
     │  └─────────────────────────────────────────────┘   │   │
     └─────────────────────────────────────────────────────┘   │
                                                               │
     ┌─────────────────────────────────────────────────────────┘
     │  AWS CloudWatch
     │  - API container logs, worker logs
     │  - Custom metric: BullMQ queue depth
     │  - Alarms: CPU > 70%, queue depth > 100 jobs
```

---

## Services & Decisions

### Compute — ECS Fargate

| Service | Tasks | CPU | Memory | Scaling Trigger |
|---------|-------|-----|--------|-----------------|
| API     | 2 (min) — 10 (max) | 512 | 1 GB | CPU utilization > 70% |
| Worker  | 1 (min) — 8 (max)  | 256 | 512 MB | BullMQ queue depth (custom CloudWatch metric) |

**Why Fargate?**
- No EC2 instance management overhead
- Per-task billing → cost-efficient for variable workloads
- Integrates with ECR, ALB, and CloudWatch natively

### Database — RDS PostgreSQL Multi-AZ

- **Instance**: `db.t3.medium` (2 vCPU, 4GB RAM)
- **Storage**: gp3 SSD, 100GB, autoscale up to 1TB
- **Multi-AZ**: Synchronous standby replica in second AZ for automatic failover
- **Backups**: 7-day automated backup + point-in-time recovery (PITR)
- **Access**: Only accessible from ECS tasks via VPC Security Group

### Cache & Queue Broker — ElastiCache Redis

- **Mode**: Single-node `cache.t3.micro` (non-cluster for simplicity at MVP scale)
- **Usage**: BullMQ job queue + rate limit sliding window counters
- **Eviction**: `allkeys-lru` policy to prevent OOM crashes
- **Failover**: Enable automatic failover when budget allows (Cluster mode)

### Log Store — MongoDB Atlas

- **Tier**: M10 Dedicated cluster (3.70GB RAM, 10GB storage)
- **Justification**: Append-only execution logs are write-heavy and schema-flexible; MongoDB document model matches `execution_log` structure better than relational tables
- **Replication**: Built-in 3-node replica set
- **Indexes**: `{ runId: 1, stepKey: 1, timestamp: 1 }` and `{ tenantId: 1, timestamp: -1 }`

### Frontend — S3 + CloudFront

- React app compiled to static files (`vite build`) → uploaded to S3
- CloudFront distribution in front of S3 for global CDN, HTTPS, cache-control
- Cache invalidation on deployment via GitHub Actions

---

## Auto-Scaling Policy

### API Service (CPU-based)

```yaml
ScalingPolicy:
  Type: TargetTrackingScaling
  Target: 70%  # CPU utilization
  ScaleOutCooldown: 60s
  ScaleInCooldown: 300s
  MinCapacity: 2
  MaxCapacity: 10
```

### Worker Service (Queue Depth — Custom Metric)

```yaml
ScalingPolicy:
  Type: StepScaling
  Metric: flowforge/BullMQ/QueueDepth
  Steps:
    - LowerBound: 0,   UpperBound: 20,  ScalingAdjustment: 0
    - LowerBound: 20,  UpperBound: 100, ScalingAdjustment: +2
    - LowerBound: 100,                  ScalingAdjustment: +4
  MinCapacity: 1
  MaxCapacity: 8
```

**BullMQ queue depth published as custom CloudWatch metric** via a lightweight Lambda that calls BullMQ's `getWaiting()` API every minute.

---

## Networking

- VPC with public + private subnets across 2 AZs
- ALB in public subnet; ECS tasks, RDS, Redis in private subnets
- NAT Gateway for outbound internet access from private subnet (Gemini API calls, etc.)
- Security Groups:
  - ALB → API tasks: port 3000
  - API/Worker → RDS: port 5432
  - API/Worker → Redis: port 6379
  - API/Worker → MongoDB Atlas: port 27017 (IP whitelist on Atlas)

---

## Observability

| Layer | Tool | What's Collected |
|-------|------|-----------------|
| Application | CloudWatch Logs (structured JSON) | All NestJS logs with `request_id`, `tenantId`, `runId` |
| Infrastructure | CloudWatch Metrics | CPU, memory, ALB request count, latency (p95, p99) |
| Database | RDS Performance Insights | Slow queries, wait events |
| Queue | Custom CloudWatch Metric | BullMQ queue depth, job failure rate |
| Alerts | CloudWatch Alarms → SNS → Slack | CPU > 70%, queue depth > 100, 5xx error rate > 1% |

### Request Tracing

Every HTTP request gets a `request_id` (UUID) injected by `LoggingInterceptor`. This ID propagates to BullMQ job data and MongoDB logs, enabling end-to-end trace of a workflow run.

---

## Security

- All secrets via AWS Secrets Manager → injected as ECS task environment variables at runtime
- RDS encryption at rest (KMS), in-transit (TLS)
- Redis AUTH token enabled on ElastiCache
- WAF attached to ALB for basic OWASP rule set
- ECR image scanning on push

---

## Deployment Pipeline

```
GitHub Push → GitHub Actions CI
  └── lint → test → build → docker-build-push (to GHCR/ECR)
              ↓
         ECS Rolling Update (API + Worker)
              ↓
         CloudFront Invalidation (Frontend)
```

---

## Cost Estimate (MVP / Low Traffic)

| Service | ~Monthly Cost |
|---------|-------------|
| ECS Fargate API (2 tasks, 512 CPU, 1GB) | ~$30 |
| ECS Fargate Worker (1 task, 256 CPU, 512MB) | ~$8 |
| RDS PostgreSQL db.t3.medium Multi-AZ | ~$80 |
| ElastiCache cache.t3.micro | ~$15 |
| MongoDB Atlas M10 | ~$60 |
| ALB | ~$20 |
| CloudFront + S3 | ~$5 |
| NAT Gateway | ~$32 |
| **Total** | **~$250/month** |

---

## Trade-offs & Future Improvements

| Trade-off | Current Decision | Future Improvement |
|-----------|-----------------|-------------------|
| MongoDB vs PostgreSQL for logs | MongoDB Atlas for schema flexibility | Consider TimescaleDB if full-SQL analytics needed |
| Single Redis node | `cache.t3.micro` — no cluster mode | Switch to ElastiCache Cluster Mode for HA at scale |
| ECS Fargate over EKS | Simpler ops, no K8s overhead | Migrate to EKS if multi-service orchestration complexity grows |
| BullMQ queue depth Lambda polling | Custom metric every 60s | Use EventBridge Pipes for real-time queue metric streaming |
