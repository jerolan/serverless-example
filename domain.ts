/**
 * Represents an entity.
 * @typedef {object} Entity
 * @property {string} id - The ID of the entity.
 * @property {number} version - The version of the entity.
 */
export type Entity = {
  id: string;
  version: number;
};

/**
 * Represents an order.
 * @typedef {object} Order
 * @property {number} amount - The amount of the order.
 * @property {string} customerId - The ID of the customer associated with the order.
 * @property {"PENDING" | "CREATED" | "REJECTED"} status - The status of the order.
 */
export type Order = Entity & {
  amount: number;
  customerId: string;
  status: "PENDING" | "CREATED" | "REJECTED";
};

/**
 * Represents a transaction.
 * @typedef {object} Transaction
 * @property {number} amount - The amount of the transaction.
 * @property {string} customerId - The ID of the customer associated with the transaction.
 * @property {string} orderId - The ID of the order associated with the transaction.
 * @property {"INCOME" | "OUTCOME"} kind - The kind of transaction (income or outcome).
 */
export type Transaction = Entity & {
  amount: number;
  customerId: string;
  orderId: string;
  kind: "INCOME" | "OUTCOME";
};

/**
 * Represents a repository that performs CRUD operations for entities of type T.
 * @interface IRepository
 * @template T - The type of the entities.
 */
export interface IRepository<T extends Entity> {
  /**
   * Adds an entity to the repository.
   * @method add
   * @param {T} entity - The entity to add.
   * @returns {void}
   */
  add(entity: T): void;

  /**
   * Updates an entity in the repository.
   * @method update
   * @param {T} entity - The entity to update.
   * @returns {void}
   */
  update(entity: T): void;

  /**
   * Retrieves an entity from the repository by its ID.
   * @method get
   * @param {string} id - The ID of the entity to retrieve.
   * @returns {Promise<T | null>} - A promise that resolves with the retrieved entity or null if not found.
   */
  get(id: string): Promise<T | null>;
}

/**
 * Represents a unit of work, which encapsulates a set of operations that are performed as a single transaction.
 */
export interface IUnitOfWork {
  /**
   * The ID of the transaction.
   * @member {string} IUnitOfWork#transactionId
   */
  transactionId: string;
  /**
   * Commits the unit of work, persisting any changes made during the transaction.
   * @method commit
   * @returns A promise that resolves when the commit operation is complete.
   */
  commit(): Promise<void>;
}
