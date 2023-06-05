## Resumen

createOrderLambda es una función en un servicio de aplicación que se encarga de crear una nueva orden. Esta función toma un objeto con un customerId y un amount como entrada, crea una nueva orden con estos datos, y luego agrega esta orden a un repositorio. También agrega un evento de integración llamado "OrderPlaced" a un servicio de eventos de integración. Finalmente, se compromete la unidad de trabajo, lo que implica que todas las operaciones realizadas durante la transacción (es decir, agregar la orden y el evento de integración) se persisten.

## Contexto y alcance

Esta función es parte de un sistema de manejo de pedidos. Se utiliza cuando un cliente realiza un pedido y se necesita crear un registro de este pedido en el sistema. El alcance de esta función es la creación de la orden y la notificación a otros componentes del sistema de que se ha realizado un pedido a través del evento de integración.

## Diseño detallado:

### API

La función createOrderLambda toma un objeto con un customerId y un amount como entrada.

### Almacenamiento de datos

La función interactúa con un orderRepository para almacenar la nueva orden.

### Código

La función crea una nueva orden con el customerId y el amount proporcionados, agrega esta orden al orderRepository, agrega un evento de integración "OrderPlaced" al integrationEventService, y luego se compromete la unidad de trabajo.

### Pseudocódigo:

```ts
function createOrderLambda({ customerId, amount }) {
  const order = {
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
  unitOfWork.commit();
  console.info(`Order created ${JSON.stringify(order)}`);
}
```

### Consecuencias

Positivas: La función permite la creación de pedidos de manera eficiente y notifica a otros componentes del sistema cuando se realiza un pedido. Esto puede facilitar la coordinación entre diferentes partes del sistema y permitir un seguimiento efectivo de los pedidos.
