
class SimpleHeaders {
  constructor() {
    this.map = {};
  }

  append(key, value) {
    const k = key.toLowerCase();
    if (!this.map[k]) {
      this.map[k] = value;
    } else {
      this.map[k] += `, ${value}`;
    }
  }

  get(key) {
    return this.map[key.toLowerCase()] || null;
  }

  has(key) {
    return key.toLowerCase() in this.map;
  }

  forEach(callback) {
    for (const [key, value] of Object.entries(this.map)) {
      callback(value, key, this);
    }
  }
}

export default SimpleHeaders;
