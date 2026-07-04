'use strict';

const WeatherHistory = require('../../models/WeatherHistory');

describe('WeatherHistory model', () => {
  test('accepts a valid climate-normal row for each defined enum value', async () => {
    const doc = new WeatherHistory({
      month: 6, monthName: 'June', avgTemp: 25, minTemp: 20, maxTemp: 30,
      humidity: 80, rainfall: 'heavy', season: 'monsoon', notes: 'Hot and humid.',
    });
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  test('rejects an out-of-range month', async () => {
    const doc = new WeatherHistory({
      month: 13, monthName: 'Invalid', avgTemp: 20, minTemp: 15, maxTemp: 25,
      humidity: 50, rainfall: 'low', season: 'winter',
    });
    await expect(doc.validate()).rejects.toThrow();
  });

  test('rejects an invalid season value', async () => {
    const doc = new WeatherHistory({
      month: 1, monthName: 'January', avgTemp: 9, minTemp: 2, maxTemp: 19,
      humidity: 65, rainfall: 'low', season: 'summer',
    });
    await expect(doc.validate()).rejects.toThrow();
  });

  test('defaults source to reference_climate_normal', () => {
    const doc = new WeatherHistory({
      month: 1, monthName: 'January', avgTemp: 9, minTemp: 2, maxTemp: 19,
      humidity: 65, rainfall: 'low', season: 'winter',
    });
    expect(doc.source).toBe('reference_climate_normal');
  });
});
