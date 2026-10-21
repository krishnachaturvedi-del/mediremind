// Shared frontend types mirroring the API responses.

export type Role = "PATIENT" | "CHEMIST" | "CAREGIVER";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  createdAt: string;
}

export interface Medication {
  id: string;
  name: string;
  doseAmount: number;
  doseUnit: string;
  quantityPerDose: number;
  quantityUnit: string;
  frequency: string;
  times: string[];
  currentQuantity: number;
  refillThreshold: number;
  startDate: string;
  endDate: string | null;
  chemistShopId: string | null;
  chemistShop?: { id: string; name: string; phone?: string; address?: string } | null;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  createdAt: string;
  updatedAt: string;
  inventoryStatus?: "IN_STOCK" | "LOW_STOCK" | "REFILL_REQUIRED";
  estimatedDaysLeft?: number | null;
}

export interface Dose {
  id: string;
  dateKey: string;
  timeStr: string;
  scheduledAt: string;
  status: "PENDING" | "TAKEN" | "SKIPPED";
  actionAt: string | null;
  quantityDelta: number;
  snoozedUntil: string | null;
  isOverdue?: boolean;
  isSnoozed?: boolean;
  medication: {
    id: string;
    name: string;
    doseAmount: number;
    doseUnit: string;
    quantityPerDose: number;
    quantityUnit: string;
    currentQuantity: number;
    refillThreshold: number;
    status?: string;
  };
}

export interface DashboardData {
  user: { name: string };
  date: { key: string; label: string };
  schedule: {
    total: number;
    taken: number;
    skipped: number;
    pending: number;
    overdue: number;
    doses: Dose[];
  };
  nextDose: {
    id: string;
    time: string;
    effectiveAt: string;
    isOverdue: boolean;
    medication: Dose["medication"];
  } | null;
  upcoming: {
    id: string;
    time: string;
    effectiveAt: string;
    medication: Dose["medication"];
  }[];
  medications: {
    total: number;
    active: number;
    paused: number;
    items: {
      id: string;
      name: string;
      currentQuantity: number;
      quantityUnit: string;
      refillThreshold: number;
      status: "IN_STOCK" | "LOW_STOCK" | "REFILL_REQUIRED";
      estimatedDaysLeft: number | null;
    }[];
  };
  inventory: {
    lowStockCount: number;
    lowStock: {
      id: string;
      name: string;
      currentQuantity: number;
      quantityUnit: string;
      refillThreshold: number;
      status: "IN_STOCK" | "LOW_STOCK" | "REFILL_REQUIRED";
      estimatedDaysLeft: number | null;
    }[];
  };
  refills: {
    pendingCount: number;
    recent: { id: string; medication: string; status: string; updatedAt: string }[];
  };
  recentActivity: {
    id: string;
    medication: string;
    status: "TAKEN" | "SKIPPED";
    actionAt: string | null;
    quantityDelta: number;
  }[];
  hasMedications: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  currentQuantity: number;
  quantityUnit: string;
  refillThreshold: number;
  status: string;
  inventoryStatus: "IN_STOCK" | "LOW_STOCK" | "REFILL_REQUIRED";
  estimatedDaysLeft: number | null;
  openAlert: { id: string; triggeredAt: string } | null;
  updatedAt: string;
}

export interface RefillRequest {
  id: string;
  medicationId: string;
  status: "PENDING" | "ACCEPTED" | "READY" | "COMPLETED" | "REJECTED" | "CANCELLED";
  origin: "AUTO" | "MANUAL";
  quantityRequested: number | null;
  rejectReason: string | null;
  patientNote: string | null;
  createdAt: string;
  updatedAt: string;
  medication: {
    name: string;
    quantityUnit: string;
    currentQuantity?: number;
    refillThreshold?: number;
    doseAmount?: number;
    doseUnit?: string;
  };
  chemistShop?: { name: string; address: string; phone: string } | null;
  user?: { id: string; name: string; phone: string | null };
  transactions: { id: string; quantitySupplied: number; confirmedAt: string }[];
}

export interface RefillAlert {
  id: string;
  status: "OPEN" | "RESOLVED";
  quantityAtTrigger: number;
  threshold: number;
  triggeredAt: string;
  resolvedAt: string | null;
  medication: { name: string; quantityUnit: string };
}

export interface CaregiverLink {
  id: string;
  status: "PENDING" | "ACTIVE" | "REVOKED";
  shareAdherence: boolean;
  shareMissed: boolean;
  shareUpcoming: boolean;
  shareRefills: boolean;
  shareInventory: boolean;
  createdAt: string;
  caregiver?: { id: string; name: string; email: string };
  patient?: { id: string; name: string };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface ChemistShop {
  id: string;
  name: string;
  address: string;
  phone: string;
  licenseNumber: string;
}

export interface ReportRow {
  id: string;
  dateKey: string;
  time: string;
  scheduledAt: string;
  actionAt: string | null;
  status: "PENDING" | "TAKEN" | "SKIPPED";
  effectiveStatus: "TAKEN" | "SKIPPED" | "MISSED" | "OVERDUE" | "SCHEDULED";
  snoozedUntil: string | null;
  quantityDelta: number;
  medication: { id: string; name: string; doseUnit: string; quantityUnit: string };
}

export interface ReportSummary {
  total: number;
  taken: number;
  skipped: number;
  missed: number;
  overdue: number;
  scheduledFuture: number;
  adherencePercent: number | null;
}
