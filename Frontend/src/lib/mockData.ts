import { ChargerData, WorkOrder } from './types'

function generateUsageHistory(baseSession: number, baseKwh: number, faultDays: number[]) {
  const days = []
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const noise = () => (Math.random() - 0.5) * 0.4
    const sessions = Math.max(1, Math.round(baseSession * (1 + noise()) * (faultDays.includes(i) ? 0 : 1)))
    const kwh = Math.max(5, Math.round(baseKwh * (1 + noise()) * (faultDays.includes(i) ? 0.1 : 1)))
    days.push({ date: dateStr, sessions: faultDays.includes(i) ? 0 : sessions, kwh: faultDays.includes(i) ? 0 : kwh, hasFault: faultDays.includes(i) })
  }
  return days
}

export const TECHNICIANS = ['Alex Rivera', 'Jordan Kim', 'Sam Patel', 'Taylor Wong', 'Morgan Chen']

export const SAMPLE_TRANSCRIPT = `Hi, I'm at the parking garage on Market Street, charger CHG-4471. It's not working at all. I plugged in my car and the light just blinks red then goes to nothing. I've tried three times now and nothing. I have fifteen percent battery left and I need to get back to work. This is the second time this week this charger has failed. Can you please get someone out here to fix this? My car is a 2023 Tesla Model 3. I don't understand why this keeps happening. The other chargers in the garage are working fine. It's just this one unit.`

export const SAMPLE_GEMINI_THINKING = `Let me analyze the diagnostic information from this call carefully. The customer reports a charger displaying a blinking red LED pattern followed by no response, which is a classic indicator of a pilot signal fault in EVSE systems. The OCPP fault code EVSE-E023 (Pilot Signal Lost) matches this symptom profile precisely. The pilot signal is the 12V control signal that negotiates charging parameters between the EV and the EVSE. When this signal is lost or corrupted, the unit cannot establish the charging session and will show a fault LED pattern before shutting down. The customer mentions this is a recurring issue — second occurrence this week — which suggests a hardware failure rather than a transient software glitch. The Pilot Signal Module (PSM) is the most likely failed component given the pattern. I should also consider the EVSE Control Board as a secondary failure point since it processes the pilot signal. The customer's frustration and urgency (15% battery, needs to return to work) indicates this should be escalated to P1 priority. The charger being completely non-functional puts it in the critical severity category. I have high confidence (94%) in this diagnosis based on the LED pattern description, the recurring nature of the fault, and the specific failure mode described.`

export const SAMPLE_GEMINI_RESULT = {
  faultCode: 'EVSE-E023',
  faultDescription: 'Pilot Signal Lost — The EVSE control pilot circuit has failed to establish or maintain communication with the vehicle.',
  confidence: 94,
  severity: 'critical' as const,
  urgency: 'P1' as const,
  downtimeRisk: 'High — Unit completely non-functional, no sessions possible',
  responseWindow: 'Within 2 hours',
  parts: [
    { name: 'Pilot Signal Module', partNumber: 'PSM-4400', stock: 'in_stock' as const },
    { name: 'EVSE Control Board', partNumber: 'ECB-2200', stock: 'low_stock' as const },
    { name: 'CP Resistor Kit', partNumber: 'CPR-100', stock: 'in_stock' as const },
  ],
  diagnosticSummary: 'The CHG-4471 unit is experiencing a complete pilot signal failure (EVSE-E023). The recurring nature of this fault — second occurrence within a week — indicates hardware degradation of the Pilot Signal Module rather than a transient software issue. The unit is completely non-functional and blocking a revenue-generating charging bay. Immediate dispatch is recommended with a PSM-4400 replacement as primary action, with an ECB-2200 board on standby. Estimated repair time: 45 minutes on-site.'
}

export const MOCK_WORK_ORDERS: WorkOrder[] = [
  {
    id: 'wo-1',
    woNumber: 'WO-2024-0847',
    date: '2024-12-15T14:23:00Z',
    chargerId: 'CHG-4471',
    location: '550 Market St, San Francisco, CA',
    customerName: 'Marcus Webb',
    faultCode: 'EVSE-E023',
    urgency: 'P1',
    status: 'dispatched',
    assignedTech: 'Alex Rivera',
    summary: 'Pilot signal loss causing complete charger failure. Customer reported unit non-functional during peak hours. Hardware replacement required.',
    parts: [
      { name: 'Pilot Signal Module', partNumber: 'PSM-4400', qty: 1, recommended: true },
      { name: 'EVSE Control Board', partNumber: 'ECB-2200', qty: 1, recommended: true },
    ],
    timeline: [
      { event: 'Work order created', timestamp: '2024-12-15T14:23:00Z' },
      { event: 'Technician assigned', timestamp: '2024-12-15T14:35:00Z', note: 'Alex Rivera dispatched' },
      { event: 'Technician en route', timestamp: '2024-12-15T14:40:00Z', note: 'ETA 25 minutes' },
    ],
  },
  {
    id: 'wo-2',
    woNumber: 'WO-2024-0831',
    date: '2024-12-10T09:15:00Z',
    chargerId: 'CHG-2209',
    location: '1 Market Plaza, San Francisco, CA',
    customerName: 'Priya Sharma',
    faultCode: 'EVSE-W012',
    urgency: 'P2',
    status: 'resolved',
    assignedTech: 'Jordan Kim',
    summary: 'High temperature warning triggered during peak load. Thermal management system replacement performed.',
    parts: [
      { name: 'Cooling Fan Assembly', partNumber: 'CFA-500', qty: 1, recommended: true },
      { name: 'Thermal Paste Kit', partNumber: 'TPK-20', qty: 1, recommended: false },
    ],
    timeline: [
      { event: 'Work order created', timestamp: '2024-12-10T09:15:00Z' },
      { event: 'Technician dispatched', timestamp: '2024-12-10T09:30:00Z' },
      { event: 'On-site arrival', timestamp: '2024-12-10T10:05:00Z' },
      { event: 'Repair completed', timestamp: '2024-12-10T11:20:00Z', note: 'Cooling fan replaced, unit operational' },
      { event: 'Work order closed', timestamp: '2024-12-10T11:25:00Z' },
    ],
    resolutionSummary: 'Cooling fan assembly was replaced successfully. Unit temperature returned to normal operating range. Charger fully operational.',
  },
  {
    id: 'wo-3',
    woNumber: 'WO-2024-0819',
    date: '2024-12-05T16:42:00Z',
    chargerId: 'CHG-8834',
    location: '100 Van Ness Ave, San Francisco, CA',
    customerName: 'Tyler Brooks',
    faultCode: 'EVSE-E001',
    urgency: 'P1',
    status: 'resolved',
    assignedTech: 'Sam Patel',
    summary: 'Ground fault detected causing immediate circuit breaker trip. Ground fault circuit interrupter replaced.',
    parts: [
      { name: 'GFCI Module', partNumber: 'GFCI-800', qty: 1, recommended: true },
      { name: 'Ground Wire Assembly', partNumber: 'GWA-100', qty: 1, recommended: true },
    ],
    timeline: [
      { event: 'Work order created', timestamp: '2024-12-05T16:42:00Z' },
      { event: 'Emergency escalation', timestamp: '2024-12-05T16:45:00Z', note: 'P1 — safety issue' },
      { event: 'Technician on-site', timestamp: '2024-12-05T17:30:00Z' },
      { event: 'Unit de-energized for safety', timestamp: '2024-12-05T17:35:00Z' },
      { event: 'Repair completed', timestamp: '2024-12-05T18:45:00Z' },
      { event: 'Safety inspection passed', timestamp: '2024-12-05T18:50:00Z' },
    ],
    resolutionSummary: 'GFCI module replaced and ground wire assembly renewed. Safety inspection passed. Unit returned to service.',
  },
  {
    id: 'wo-4',
    woNumber: 'WO-2024-0805',
    date: '2024-12-01T11:00:00Z',
    chargerId: 'CHG-4471',
    location: '550 Market St, San Francisco, CA',
    customerName: 'Lisa Chen',
    faultCode: 'EVSE-E047',
    urgency: 'P2',
    status: 'resolved',
    assignedTech: 'Taylor Wong',
    summary: 'Communication timeout causing session failures. Network module firmware updated and antenna replaced.',
    parts: [
      { name: 'LTE Antenna Module', partNumber: 'LTE-300', qty: 1, recommended: true },
    ],
    timeline: [
      { event: 'Work order created', timestamp: '2024-12-01T11:00:00Z' },
      { event: 'Remote diagnostics performed', timestamp: '2024-12-01T11:30:00Z' },
      { event: 'Technician dispatched', timestamp: '2024-12-01T12:00:00Z' },
      { event: 'Firmware update applied', timestamp: '2024-12-01T13:15:00Z' },
      { event: 'Antenna replaced', timestamp: '2024-12-01T13:45:00Z' },
      { event: 'Work order closed', timestamp: '2024-12-01T14:00:00Z' },
    ],
    resolutionSummary: 'LTE antenna replaced and firmware updated to v4.2.1. Communication restored, all sessions completing successfully.',
  },
  {
    id: 'wo-5',
    woNumber: 'WO-2024-0798',
    date: '2024-11-28T08:30:00Z',
    chargerId: 'CHG-2209',
    location: '1 Market Plaza, San Francisco, CA',
    customerName: 'David Park',
    faultCode: 'EVSE-E089',
    urgency: 'P1',
    status: 'open',
    assignedTech: null,
    summary: 'Contactor failure preventing power delivery to vehicle. Unit shows green LED but no current flows.',
    parts: [
      { name: 'Main Contactor Assembly', partNumber: 'MCA-1200', qty: 1, recommended: true },
      { name: 'Contactor Driver Board', partNumber: 'CDB-400', qty: 1, recommended: true },
    ],
    timeline: [
      { event: 'Work order created', timestamp: '2024-11-28T08:30:00Z' },
      { event: 'Awaiting technician assignment', timestamp: '2024-11-28T08:31:00Z' },
    ],
  },
  {
    id: 'wo-6',
    woNumber: 'WO-2024-0787',
    date: '2024-11-22T14:00:00Z',
    chargerId: 'CHG-8834',
    location: '100 Van Ness Ave, San Francisco, CA',
    customerName: 'Sarah Johnson',
    faultCode: 'EVSE-W012',
    urgency: 'P3',
    status: 'on_hold',
    assignedTech: 'Morgan Chen',
    summary: 'Intermittent high temperature warnings. No parts currently available. Monitoring remotely.',
    parts: [
      { name: 'Cooling Fan Assembly', partNumber: 'CFA-500', qty: 1, recommended: true },
    ],
    timeline: [
      { event: 'Work order created', timestamp: '2024-11-22T14:00:00Z' },
      { event: 'Put on hold — parts unavailable', timestamp: '2024-11-22T15:00:00Z' },
    ],
  },
  {
    id: 'wo-7',
    woNumber: 'WO-2024-0771',
    date: '2024-11-18T10:15:00Z',
    chargerId: 'CHG-4471',
    location: '550 Market St, San Francisco, CA',
    customerName: 'Robert Kim',
    faultCode: 'EVSE-E047',
    urgency: 'P2',
    status: 'resolved',
    assignedTech: 'Alex Rivera',
    summary: 'Network communication timeout. Backend connectivity issue resolved with firmware patch.',
    parts: [],
    timeline: [
      { event: 'Work order created', timestamp: '2024-11-18T10:15:00Z' },
      { event: 'Remote fix applied', timestamp: '2024-11-18T10:45:00Z' },
      { event: 'Work order closed', timestamp: '2024-11-18T11:00:00Z' },
    ],
    resolutionSummary: 'Resolved remotely via OTA firmware patch. No hardware replacement required.',
  },
  {
    id: 'wo-8',
    woNumber: 'WO-2024-0755',
    date: '2024-11-12T09:00:00Z',
    chargerId: 'CHG-2209',
    location: '1 Market Plaza, San Francisco, CA',
    customerName: 'Nina Patel',
    faultCode: 'EVSE-E001',
    urgency: 'P1',
    status: 'resolved',
    assignedTech: 'Jordan Kim',
    summary: 'Ground fault triggered safety shutoff. Annual safety inspection revealed worn insulation.',
    parts: [
      { name: 'GFCI Module', partNumber: 'GFCI-800', qty: 1, recommended: true },
      { name: 'Cable Insulation Kit', partNumber: 'CIK-50', qty: 2, recommended: false },
    ],
    timeline: [
      { event: 'Work order created', timestamp: '2024-11-12T09:00:00Z' },
      { event: 'Emergency dispatch', timestamp: '2024-11-12T09:10:00Z' },
      { event: 'On-site', timestamp: '2024-11-12T09:55:00Z' },
      { event: 'Repair completed', timestamp: '2024-11-12T11:30:00Z' },
    ],
    resolutionSummary: 'Ground fault module replaced. Cable insulation renewed. Unit passed safety inspection.',
  },
  {
    id: 'wo-9',
    woNumber: 'WO-2024-0740',
    date: '2024-11-05T13:30:00Z',
    chargerId: 'CHG-8834',
    location: '100 Van Ness Ave, San Francisco, CA',
    customerName: 'Carlos Martinez',
    faultCode: 'EVSE-E023',
    urgency: 'P2',
    status: 'resolved',
    assignedTech: 'Sam Patel',
    summary: 'Pilot signal fault. Pilot Signal Module replaced.',
    parts: [
      { name: 'Pilot Signal Module', partNumber: 'PSM-4400', qty: 1, recommended: true },
    ],
    timeline: [
      { event: 'Work order created', timestamp: '2024-11-05T13:30:00Z' },
      { event: 'Technician dispatched', timestamp: '2024-11-05T14:00:00Z' },
      { event: 'Repair completed', timestamp: '2024-11-05T15:30:00Z' },
    ],
    resolutionSummary: 'PSM-4400 replaced. Unit operational.',
  },
  {
    id: 'wo-10',
    woNumber: 'WO-2024-0722',
    date: '2024-10-29T08:00:00Z',
    chargerId: 'CHG-4471',
    location: '550 Market St, San Francisco, CA',
    customerName: 'Amanda Foster',
    faultCode: 'EVSE-W012',
    urgency: 'P3',
    status: 'resolved',
    assignedTech: 'Taylor Wong',
    summary: 'High temperature warning during heatwave. Cooling system serviced and firmware optimized.',
    parts: [
      { name: 'Thermal Paste Kit', partNumber: 'TPK-20', qty: 1, recommended: true },
    ],
    timeline: [
      { event: 'Work order created', timestamp: '2024-10-29T08:00:00Z' },
      { event: 'Scheduled maintenance visit', timestamp: '2024-10-29T10:00:00Z' },
      { event: 'Service completed', timestamp: '2024-10-29T11:00:00Z' },
    ],
    resolutionSummary: 'Thermal management serviced. Temperature back within spec after ambient temperature dropped.',
  },
]

export const MOCK_CHARGERS: ChargerData[] = [
  {
    id: 'CHG-4471',
    location: '550 Market St, San Francisco, CA 94104',
    model: 'ChargePoint CPE 250',
    installDate: '2022-03-15',
    firmwareVersion: 'v4.1.9',
    lastServiced: '2024-12-01',
    status: 'offline',
    healthScore: 42,
    usageHistory: generateUsageHistory(8, 120, [2, 5, 8]),
    pastWorkOrders: MOCK_WORK_ORDERS.filter(wo => wo.chargerId === 'CHG-4471').slice(0, 5),
  },
  {
    id: 'CHG-2209',
    location: '1 Market Plaza, San Francisco, CA 94105',
    model: 'ABB Terra 184',
    installDate: '2021-07-22',
    firmwareVersion: 'v3.8.2',
    lastServiced: '2024-10-15',
    status: 'degraded',
    healthScore: 58,
    usageHistory: generateUsageHistory(11, 180, [3, 12]),
    pastWorkOrders: MOCK_WORK_ORDERS.filter(wo => wo.chargerId === 'CHG-2209').slice(0, 5),
  },
  {
    id: 'CHG-8834',
    location: '100 Van Ness Ave, San Francisco, CA 94102',
    model: 'Blink IQ 200',
    installDate: '2020-11-10',
    firmwareVersion: 'v2.9.5',
    lastServiced: '2024-09-01',
    status: 'offline',
    healthScore: 23,
    usageHistory: generateUsageHistory(5, 80, [1, 4, 7, 10, 15]),
    pastWorkOrders: MOCK_WORK_ORDERS.filter(wo => wo.chargerId === 'CHG-8834').slice(0, 5),
  },
]
