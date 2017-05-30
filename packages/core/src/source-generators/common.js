/**
 * Created by arolave on 29/05/2017.
 */
export function getFromInstanceId(instanceId, app = process.env.APP) { // eslint-disable-line import/prefer-default-export
  return app ? `${app}:${instanceId}` : instanceId;
}
