# Module Map

## Client Libraries
|Module|Purpose|

## Server Libraries
|Module|Purpose|

## Primary Packages
|Module|Purpose|
|stellar-error|Contains the base Error class for errors to be serialised with errors at the property level|
|core|Contains the primary API classes for requests, handlers, publishers and subscribers|
|abstract-transport|Contains the Interfaces for both synchronous transports and async transports|

## Transports
|Module|Purpose|
|abstract-transport-queue|Contains the basic abstract classes for queue based implementations|
|transport-bull|Contains the subclass of QueueTransport (see abstract-transport-queue) for bull & redis|
|transport-socket|Contains the subsclass of RemoteTransport (see abstract-transport) for an engine-io/websocket socket|
|transport-bee|Contains the subclass of QueueTransport (see abstract-transport-queue) for bee & redis|
|transport-memory|Contains the subclass of Transport (see abstract-transport) for an implementation of pure memory based transport|

## Middlewares
|Module|Purpose|


