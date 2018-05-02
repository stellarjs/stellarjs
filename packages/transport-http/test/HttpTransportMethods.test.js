import HttpTransport from '../src';

describe('HttpTransport Methods', () => {
  it('test getHttpMethodAndUrlFromQueueName', () => {
    const transport = new HttpTransport();
    expect(transport.getHttpMethodAndUrlFromQueueName('a:b:c:get')).toEqual({
        url: '/a/b/c',
        method: 'get',
    });
      expect(transport.getHttpMethodAndUrlFromQueueName('a:b:c:create')).toEqual({
          url: '/a/b/c',
          method: 'put',
      });
      expect(transport.getHttpMethodAndUrlFromQueueName('a:b:c:update')).toEqual({
          url: '/a/b/c',
          method: 'post',
      });
      expect(transport.getHttpMethodAndUrlFromQueueName('a:b:c:remove')).toEqual({
          url: '/a/b/c',
          method: 'delete',
      });
  });

});