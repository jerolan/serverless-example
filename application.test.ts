import { v4 as uuid } from "uuid";
import { IRepository, IUnitOfWork, Order } from "./domain";
import { IIntegrationEventService, buildCreateOrder } from "./application";

describe("buildCreateOrder", () => {
  let unitOfWork: IUnitOfWork;
  let orderRepository: IRepository<Order>;
  let integrationEventService: IIntegrationEventService;
  let createOrder: (event: {
    customerId: string;
    amount: number;
  }) => Promise<Order>;

  beforeEach(() => {
    unitOfWork = {
      transactionId: uuid(),
      commit: jest.fn(),
    };

    orderRepository = {
      add: jest.fn(),
    };

    integrationEventService = {
      add: jest.fn(),
      publish: jest.fn(),
    };

    createOrder = buildCreateOrder(
      unitOfWork,
      orderRepository,
      integrationEventService
    );
  });

  test("should create an order and add integration event", async () => {
    const customerId = "customer123";
    const amount = 100;

    const order = await createOrder({ customerId, amount });

    expect(order).toEqual(
      expect.objectContaining({
        customerId,
        amount,
        status: "PENDING",
      })
    );

    expect(orderRepository.add).toHaveBeenCalledWith(order);
    expect(integrationEventService.add).toHaveBeenCalledWith({
      name: "OrderPlaced",
      payload: { id: order.id },
    });
    expect(unitOfWork.commit).toHaveBeenCalled();
  });
});
