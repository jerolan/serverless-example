import { v4 as uuid } from "uuid";
import * as Domain from "./domain";

/**
 * Builds a function to create an order.
 * @param unitOfWork - The unit of work for transaction management.
 * @param orderRepository - The repository for order entities.
 * @param integrationEventService - The service for handling integration events.
 * @returns The created order.
 */
export function buildCreateOrderService(
  unitOfWork: Domain.IUnitOfWork,
  orderRepository: Domain.IRepository<Domain.Order>,
  integrationEventService: IIntegrationEventService
) {
  /**
   * Creates an order.
   * @param {Object} event - The event data for creating an order.
   * @param {string} event.customerId - The ID of the customer placing the order.
   * @param {number} event.amount - The amount of the order.
   * @returns {Promise<void>} A promise that resolves when the order is created.
   */
  return async function createOrder({
    customerId,
    amount,
  }: {
    customerId: string;
    amount: number;
  }): Promise<void> {
    const order: Domain.Order = {
      customerId,
      amount,
      id: uuid(),
      status: "PENDING",
      version: 1,
    };

    orderRepository.add(order);
    integrationEventService.add({
      name: "OrderPlaced",
      payload: {
        amount: order.amount,
        orderId: order.id,
        customerId: order.customerId,
      },
    });

    await unitOfWork.commit();
    console.info(`Order created ${JSON.stringify(order)}`);
  };
}

/**
 * Builds a function to reserve credit.
 * @param unitOfWork - The unit of work for transaction management.
 * @param transactionsRepository - The repository for transaction entities.
 * @param integrationEventService - The service for handling integration events.
 * @returns The reserve credit function.
 */
export function buildReserveCreditService(
  unitOfWork: Domain.IUnitOfWork,
  transactionsRepository: Domain.IRepository<Domain.Transaction>,
  integrationEventService: IIntegrationEventService
) {
  /**
   * Reserves credit for an order.
   * @param {Object} reservation - The reservation data.
   * @param {string} reservation.customerId - The ID of the customer.
   * @param {number} reservation.amount - The amount of credit to reserve.
   * @param {string} reservation.orderId - The ID of the order.
   * @returns {Promise<void>} A promise that resolves when the credit is reserved.
   */
  return async function reserveCreditService({
    customerId,
    amount,
    orderId,
  }: {
    customerId: string;
    amount: number;
    orderId: string;
  }): Promise<void> {
    // fake credit checking...
    const isCreditReserved = Math.random() < 0.5;

    let transaction: Domain.Transaction | undefined;
    if (isCreditReserved) {
      transaction = {
        customerId,
        orderId,
        amount,
        id: uuid(),
        kind: "OUTCOME",
        version: 1,
      };

      transactionsRepository.add(transaction);
      console.info(`Transaction created; reserved credit ${amount}`);
    } else {
      console.warn(`Customer doesn't have enough credit; required ${amount}`);
    }

    integrationEventService.add({
      name: "ReservationOutcome",
      payload: { isCreditReserved, orderId },
    });

    await unitOfWork.commit();
  };
}

/**
 * Builds a function to handle the outcome of credit reservation.
 * @param unitOfWork - The unit of work for transaction management.
 * @param ordersRepository - The repository for order entities.
 * @returns The handle reservation outcome function.
 */
export function buildHandleReservationOutcomeService(
  unitOfWork: Domain.IUnitOfWork,
  ordersRepository: Domain.IRepository<Domain.Order>
) {
  /**
   * Handles the outcome of credit reservation.
   * @param {Object} outcome - The reservation outcome data.
   * @param {string} outcome.orderId - The ID of the order.
   * @param {boolean} outcome.isCreditReserved - Indicates whether credit was successfully reserved.
   * @returns {Promise<void>} A promise that resolves when the outcome is handled.
   */
  return async function handleReservationOutcomeService({
    orderId,
    isCreditReserved,
  }: {
    orderId: string;
    isCreditReserved: boolean;
  }): Promise<void> {
    console.info(`Reading info for ${orderId}`);
    const order = await ordersRepository.get(orderId);
    console.info(`Order found ${JSON.stringify(order)}`);
    if (order) {
      order.status = isCreditReserved ? "CREATED" : "REJECTED";
      ordersRepository.update(order);
      await unitOfWork.commit();
    }
  };
}

/**
 * Represents an integration event.
 * @template T - The type of the payload.
 */
export type IntegrationEvent<T> = {
  name: string;
  payload: T;
};

/**
 * Represents a service for handling integration events.
 */
export interface IIntegrationEventService {
  /**
   * Adds an integration event to the service.
   * @template T - The type of the event payload.
   * @param {IntegrationEvent<T>} event - The integration event to add.
   * @returns {void}
   */
  add<T>(event: IntegrationEvent<T>): void;

  /**
   * Publishes the added integration events.
   * @param {string} transactionId - The transaction id for the group of integration events.
   * @returns {Promise<void>} A promise that resolves when the publishing is complete.
   */
  publish(transactionId: string): Promise<void>;
}
