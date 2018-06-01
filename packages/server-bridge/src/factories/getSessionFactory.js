import get from 'lodash/get';

export default function getSessionFactory({ sessions }) {
  return function getSession(path) {
    return get(sessions, path);
  };
}
