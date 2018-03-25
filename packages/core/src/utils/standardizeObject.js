export default function standardizeObjectFactory({ stringifyDates }) {
  if (!stringifyDates) {
    return function (x) {
      return x;
    };
  }

  return function standardizeObject(obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : obj;
  };
}
