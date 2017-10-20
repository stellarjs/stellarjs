/**
 * Created by arolave on 29/05/2017.
 */
// eslint-disable-next-line import/prefer-default-export
export function getFromInstanceId(instanceId, app = process.env.APP) {
  return app ? `${app}:${instanceId}` : instanceId;
}
