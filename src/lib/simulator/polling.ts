/** Poll interval for simulator checkout detail; false stops polling on terminal status. */
export function getSimulatorPaymentRefetchInterval(
  status: string | undefined,
): number | false {
  return status === 'CREATED' || status === 'PENDING' ? 2000 : false;
}
