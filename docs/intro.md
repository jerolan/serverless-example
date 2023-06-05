### Serverless ejemplo

![Diagrama](./diagram.svg)

La aplicación es un sistema serverless diseñado para manejar eventos de integración utilizando AWS Lambda y DynamoDB. Está compuesta por varias funciones Lambda que realizan diferentes tareas relacionadas con la creación de órdenes, la reserva de crédito y el manejo de los resultados de la reserva.

En primer lugar, la función createOrderLambda se encarga de crear una orden. Recibe un evento que contiene información como el monto de la orden y el ID del cliente. Esta función utiliza un patrón de unidad de trabajo (UnitOfWork) para garantizar que todas las operaciones relacionadas se realicen como una transacción única. La orden se registra en un repositorio de órdenes y se agrega un evento de integración llamado "OrderPlaced" al servicio de eventos de integración.

A continuación, la función reserveCreditLambda se encarga de reservar crédito para una orden. Recibe un evento que incluye detalles como el monto de crédito, el ID de la orden y el ID del cliente. En esta función, se realiza una verificación de crédito simulada y se registra una transacción en un repositorio de transacciones. Además, se agrega un evento de integración llamado "ReservationOutcome" al servicio de eventos de integración.

Por último, la función handleReservationOutcomeLambda maneja el resultado de la reserva de crédito. Recibe un evento que contiene el ID de la orden y un indicador de si se reservó o no el crédito. En esta función, se actualiza el estado de la orden en el repositorio de órdenes en función del resultado de la reserva.

La aplicación utiliza un patrón de repositorio para interactuar con la tabla de órdenes y la tabla de transacciones en DynamoDB. Además, implementa un servicio de eventos de integración que permite agregar eventos y publicarlos en un bus de eventos personalizado.

En resumen, esta aplicación serverless proporciona una forma escalable y flexible de manejar eventos de integración relacionados con la creación de órdenes, la reserva de crédito y el seguimiento de los resultados de la reserva. Utiliza servicios de AWS como Lambda y DynamoDB para garantizar la disponibilidad y la durabilidad de los datos.
