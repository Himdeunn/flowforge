import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  // AsyncLocalStorage to store the current tenantId for tenant isolation
  public static readonly tenantStorage = new AsyncLocalStorage<string>();

  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error'],
    });

    // Extend Prisma Client to automatically inject tenantId filter
    return new Proxy(this, {
      get(target, prop, receiver) {
        const originVal = Reflect.get(target, prop, receiver);

        // Intercept database model operations (e.g., prisma.workflowDefinition, prisma.user)
        if (
          typeof originVal === 'object' &&
          originVal !== null &&
          typeof (originVal as any).findMany === 'function'
        ) {
          return new Proxy(originVal, {
            get(modelTarget, modelProp) {
              const originalMethod = Reflect.get(modelTarget, modelProp);

              if (typeof originalMethod === 'function') {
                return async function (...args: any[]) {
                  const tenantId = PrismaService.tenantStorage.getStore();

                  // Only inject tenantId if it's set in the context
                  if (tenantId) {
                    const queryArgs = args[0] || {};

                    // List of models that have tenantId field
                    const modelName = String(prop).toLowerCase();
                    const modelsWithTenant = [
                      'user',
                      'workflowdefinition',
                      'workflowrun',
                    ];

                    if (modelsWithTenant.includes(modelName)) {
                      // Inject tenantId filter on methods that accept where
                      if (modelProp !== 'create' && modelProp !== 'createMany') {
                        queryArgs.where = queryArgs.where || {};
                        queryArgs.where.tenantId = tenantId;
                      }

                      // Inject tenantId on create
                      if (modelProp === 'create') {
                        queryArgs.data = queryArgs.data || {};
                        queryArgs.data.tenantId = tenantId;
                      }
                      if (modelProp === 'createMany') {
                        if (Array.isArray(queryArgs.data)) {
                          queryArgs.data = queryArgs.data.map((item: any) => ({
                            ...item,
                            tenantId,
                          }));
                        } else {
                          queryArgs.data = queryArgs.data || {};
                          queryArgs.data.tenantId = tenantId;
                        }
                      }
                    }
                    args[0] = queryArgs;
                  }

                  return originalMethod.apply(modelTarget, args);
                };
              }
              return originalMethod;
            },
          });
        }

        return originVal;
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
