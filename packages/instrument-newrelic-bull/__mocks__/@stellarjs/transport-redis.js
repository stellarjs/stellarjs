const transport = jest.genMockFromModule('@stellarjs/transport-redis');

class RedisTransport {}
RedisTransport.prototype.enqueue = jest.fn();
RedisTransport.prototype.process = jest.fn();

transport.RedisTransport = RedisTransport;

export default transport;
