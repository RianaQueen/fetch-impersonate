export const makeEnum = (type, values) => {
  const en = {...values};
  en._enum = type;

  en.fromString = (str) => {
    const val = en[str];
    if (val && Number.isInteger(val)) return val;
    throw new Error('Wrong ' + type + ' key: ' + str);
  };

  en.stringify = (val) => {
    const str = en._reverse[val];
    if (str) return str;
    throw new Error('Wrong ' + type + ' value: ' + val);
  };
  en._reverse = Object.fromEntries(
    Object.entries(en).map(([k, v]) => [v, k])
  );

  return en;
};