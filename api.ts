import * as DynamoDbClient from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import * as EventBridgeClient from "@aws-sdk/client-eventbridge";
import { v4 as uuid } from "uuid";
import * as Application from "./application";
import * as Domain from "./domain";

const docClient = new DynamoDbClient.DynamoDB({});
const eventBridgeClient = new EventBridgeClient.EventBridge({});

/**
 * Represents the event data for creating an order.
 */
export type CreateOrderEvent = {
  amount: number;
  customerId: string;
};

/**
 * Handles the creation of an order.
 * @param {CreateOrderEvent} event - The event data for creating an order.
 * @returns {Promise<void>} A promise that resolves when the order creation is complete.
 */
export async function createOrderLambda(
  event: CreateOrderEvent
): Promise<void> {
  // setup application dependencies.
  const unitOfWork = createUnitOfWork(docClient);
  const ordersRepository = createRepository<Domain.Order>(
    process.env.ORDERS_TABLE_NAME!,
    unitOfWork,
    docClient
  );
  const integrationEventService: Application.IIntegrationEventService =
    createIntegrationEventService(unitOfWork, docClient, eventBridgeClient);
  const createOrderService = Application.buildCreateOrderService(
    unitOfWork,
    ordersRepository,
    integrationEventService
  );

  // execute the application workflow.
  await createOrderService({
    amount: event.amount,
    customerId: event.customerId,
  });
  await integrationEventService.publish(unitOfWork.transactionId);

  return;
}

/**
 * Represents the event data for reserving credit.
 */
export type ReserveCreditEvent = {
  amount: number;
  orderId: string;
  customerId: string;
};

/**
 * Handles the reservation of credit.
 * @param {ReserveCreditEvent} event - The event data for reserving credit.
 * @returns {Promise<void>} A promise that resolves when the credit reservation is complete.
 */
export async function reserveCreditLambda({
  detail: event,
}: {
  detail: ReserveCreditEvent;
}): Promise<void> {
  // setup application dependencies.
  const unitOfWork = createUnitOfWork(docClient);
  const transactionsRepository: Domain.IRepository<Domain.Transaction> =
    createRepository(
      process.env.TRANSACTIONS_TABLE_NAME!,
      unitOfWork,
      docClient
    );
  const integrationEventService: Application.IIntegrationEventService =
    createIntegrationEventService(unitOfWork, docClient, eventBridgeClient);
  const reserveCreditService = Application.buildReserveCreditService(
    unitOfWork,
    transactionsRepository,
    integrationEventService
  );

  // execute the application workflow.
  await reserveCreditService({
    amount: event.amount,
    orderId: event.orderId,
    customerId: event.customerId,
  });
  await integrationEventService.publish(unitOfWork.transactionId);

  return;
}

/**
 * Represents the event data for handling reservation outcome.
 */
export type HandleReservationOutcomeEvent = {
  orderId: string;
  isCreditReserved: boolean;
};

/**
 * Handles the reservation outcome.
 * @param {HandleReservationOutcomeEvent} event - The event data for handling reservation outcome.
 * @returns {Promise<void>} A promise that resolves when the reservation outcome is handled.
 */
export async function handleReservationOutcomeLambda({
  detail: event,
}: {
  detail: HandleReservationOutcomeEvent;
}): Promise<void> {
  // setup application dependencies.
  const unitOfWork = createUnitOfWork(docClient);
  const ordersRepository: Domain.IRepository<Domain.Order> = createRepository(
    process.env.ORDERS_TABLE_NAME!,
    unitOfWork,
    docClient
  );
  const integrationEventService: Application.IIntegrationEventService =
    createIntegrationEventService(unitOfWork, docClient, eventBridgeClient);
  const reserveCreditService = Application.buildHandleReservationOutcomeService(
    unitOfWork,
    ordersRepository
  );

  // execute the application workflow.
  await reserveCreditService({
    orderId: event.orderId,
    isCreditReserved: event.isCreditReserved,
  });
  await integrationEventService.publish(unitOfWork.transactionId);

  return;
}

/**
 * Represents a unit of work for performing a batch of operations.
 */
type DynamoDbUnitOfWork = Domain.IUnitOfWork & {
  /**
   * Registers an operation to be included in the unit of work.
   * @param {DynamoDbClient.TransactWriteItem[]} operation - The operation details to register.
   * @returns {void}
   */
  register: (operation: DynamoDbClient.TransactWriteItem[]) => void;
};

/**
 * Creates a unit of work for interacting with DynamoDB and performing batch operations.
 * @param {DynamoDbClient.DynamoDB} docClient - The DynamoDB client instance.
 * @returns {DynamoDbUnitOfWork} The created unit of work.
 */
function createUnitOfWork(
  docClient: DynamoDbClient.DynamoDB
): DynamoDbUnitOfWork {
  const transactionId = uuid();
  const operations: Array<DynamoDbClient.TransactWriteItem> = [];

  return {
    transactionId,
    register: (operation: DynamoDbClient.TransactWriteItem[]): void => {
      operations.push(...operation);
      console.debug(
        `Operation added to unit of work ${JSON.stringify(operation)}`
      );
    },
    commit: async (): Promise<void> => {
      try {
        const data = await docClient.transactWriteItems({
          TransactItems: operations,
        });
        console.log("UnitOfWork committed successfully:", data);
      } catch (error) {
        console.error("Error committing UnitOfWork:", error);
        throw error;
      }
    },
  };
}

/**
 * Creates a repository for performing operations on a specific table.
 * @param {string} tableName - The name of the table.
 * @param {DynamoDbUnitOfWork} unitOfWork - The unit of work associated with the repository.
 * @param {DynamoDbClient.DynamoDB} docClient - The DynamoDB client instance.
 * @returns {Domain.IRepository<T>} The created repository.
 */
function createRepository<T extends Domain.Entity>(
  tableName: string,
  unitOfWork: DynamoDbUnitOfWork,
  docClient: DynamoDbClient.DynamoDB
): Domain.IRepository<T> {
  function convertObjectToDynamoDBUpdate(obj: any): any {
    const updateExpressionParts: string[] = [];
    const expressionAttributeValues: any = {};
    const expressionAttributeNames: any = {};

    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        const attributeName = `#${key}`;
        const attributeValue = `:${key}`;

        updateExpressionParts.push(`${attributeName} = ${attributeValue}`);
        expressionAttributeNames[attributeName] = key;
        expressionAttributeValues[attributeValue] = marshall(value);
      }
    }

    const updateExpression = `SET ${updateExpressionParts.join(", ")}`;

    return {
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
    };
  }

  return {
    add: (entity: Domain.Entity): void => {
      entity.version = 1;
      unitOfWork.register([
        {
          Put: {
            TableName: tableName,
            Item: marshall(entity),
          },
        },
      ]);
    },
    update: (entity: Domain.Entity): void => {
      const { id, ...entityValues } = entity;
      entityValues.version++;
      console.info(convertObjectToDynamoDBUpdate(entityValues));
      const {
        UpdateExpression,
        ExpressionAttributeValues,
        ExpressionAttributeNames,
      } = convertObjectToDynamoDBUpdate(entityValues);
      unitOfWork.register([
        {
          Update: {
            TableName: tableName,
            Key: { id: { S: id } },
            UpdateExpression: UpdateExpression,
            ConditionExpression: "#version = :currentVersion",
            ExpressionAttributeNames: {
              "#version": "version",
              ...ExpressionAttributeNames,
            },
            ExpressionAttributeValues: {
              ":currentVersion": { N: `${entityValues.version - 1}` },
              ...ExpressionAttributeValues,
            },
          },
        },
      ]);
    },
    get: async (id: string): Promise<T | null> => {
      const params: DynamoDbClient.GetItemCommandInput = {
        TableName: tableName,
        Key: {
          id: {
            S: id,
          },
        },
      };

      try {
        const result = await docClient.getItem(params);
        if (result.Item == null) {
          return null;
        }

        return unmarshall(result.Item) as T;
      } catch (error) {
        console.error("Error retrieving item from the repository:", error);
        throw error;
      }
    },
  };
}

/**
 * Creates an integration event service for handling integration events in DynamoDB.
 * @param {DynamoDbUnitOfWork} unitOfWork - The unit of work associated with the integration event service.
 * @param {DynamoDbClient.DynamoDB} docClient - The DynamoDB client instance.
 * @returns {Application.IIntegrationEventService} The created integration event service.
 */
function createIntegrationEventService(
  unitOfWork: DynamoDbUnitOfWork,
  docClient: DynamoDbClient.DynamoDB,
  eventBridgeClient: EventBridgeClient.EventBridge
): Application.IIntegrationEventService {
  const tableName = process.env.INTEGRATION_EVENTS_TABLE_NAME!;

  async function retrieveEventLogsPendingToPublish(
    transactionId: string
  ): Promise<any[]> {
    const params: DynamoDbClient.ScanCommandInput = {
      TableName: tableName,
      FilterExpression: "#status = :status AND transactionId = :transactionId",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": {
          S: "NOT_PUBLISHED",
        },
        ":transactionId": {
          S: transactionId,
        },
      },
    };

    try {
      const result = await docClient.scan(params);
      if (result.Items) {
        return result.Items.map((item) => unmarshall(item));
      } else {
        return [];
      }
    } catch (error) {
      console.error("Error fetching integration events:", error);
      throw error;
    }
  }

  async function markEventAsPublished(eventId: string): Promise<void> {
    await updateEventStatus(eventId, "PUBLISHED");
  }

  async function markEventAsInProgress(eventId: string): Promise<void> {
    await updateEventStatus(eventId, "IN_PROGRESS");
  }

  async function markEventAsFailed(eventId: string): Promise<void> {
    await updateEventStatus(eventId, "FAILED");
  }

  async function updateEventStatus(
    eventId: string,
    status: string
  ): Promise<void> {
    const params: DynamoDbClient.UpdateItemCommandInput = {
      TableName: tableName,
      Key: { id: { S: eventId } },
      UpdateExpression: "SET #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": {
          S: status,
        },
      },
    };

    try {
      await docClient.updateItem(params);
    } catch (error) {
      console.error("Error updating integration event status:", error);
      throw error;
    }
  }

  return {
    add<T>(event: Application.IntegrationEvent<T>): void {
      unitOfWork.register([
        {
          Put: {
            TableName: tableName,
            Item: marshall({
              ...event,
              payload: JSON.stringify(event.payload),
              id: uuid(),
              status: "NOT_PUBLISHED",
              transactionId: unitOfWork.transactionId,
            }),
          },
        },
      ]);
    },
    publish: async (transactionId: string): Promise<void> => {
      try {
        const events = await retrieveEventLogsPendingToPublish(transactionId);
        await Promise.allSettled(
          events.map(async (item) => {
            try {
              await markEventAsInProgress(item.id);
              await retryWithExponentialBackoff(() => {
                var event = {
                  EventBusName: process.env.INTEGRATION_EVENTS_EVENT_BUS!,
                  Source: process.env.INTEGRATION_EVENTS_SOURCE!,
                  DetailType: item.name,
                  Detail: item.payload,
                };

                console.debug(`Publishing event: ${JSON.stringify(event)}`);
                return eventBridgeClient.putEvents({
                  Entries: [event],
                });
              });
              console.debug(`Publish event with id ${item.id}`);
              await markEventAsPublished(item.id);
            } catch (err) {
              console.error(`Error publishing integration event ${item.id}`);
              await markEventAsFailed(item.id);
            }
          })
        );
      } catch (error) {
        console.error("Error publishing integration events:", error);
        throw error;
      }
    },
  };
}

const retryWithExponentialBackoff = async (
  func: () => Promise<any>,
  maxRetries: number = 5,
  baseDelay: number = 1000,
  maxDelay: number = 5000
): Promise<any> => {
  let retries = 0;
  let delay = baseDelay;

  while (retries < maxRetries) {
    try {
      return await func();
    } catch (err) {
      console.error(err);
      if (retries === maxRetries - 1) {
        throw err;
      }

      retries++;
      await sleep(delay);
      delay = Math.min(delay * 2, maxDelay);
    }
  }
};

const sleep = (delay: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, delay));
};
