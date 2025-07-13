import { PenetrationTester } from '../../security/pen-test';

describe('Penetration Testing Suite', () => {
  test('full scan returns expected results', async () => {
    const tester = new PenetrationTester();
    jest.spyOn(tester, 'testSQLi').mockResolvedValue(true);
    jest.spyOn(tester, 'testXSS').mockResolvedValue(false);
    jest.spyOn(tester, 'testAuthBypass').mockResolvedValue(true);
    
    const results = await tester.runFullScan();
    
    expect(results).toEqual([
      { test: 'SQL Injection', status: 'PASS', severity: 'CRITICAL' },
      { test: 'XSS', status: 'FAIL', severity: 'HIGH' },
      { test: 'Auth Bypass', status: 'PASS', severity: 'CRITICAL' }
    ]);
  });
});
