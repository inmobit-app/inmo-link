export type UserRole = 'CLIENT' | 'BROKER' | 'OWNER' | 'ADMIN';
export type PropertyType = 'HOUSE' | 'APARTMENT' | 'LAND' | 'COMMERCIAL' | 'GARAGE';
export type OperationType = 'SALE' | 'RENT';
export type PropertyStatus = 'DRAFT' | 'ACTIVE' | 'RESERVED' | 'SOLD' | 'RENTED' | 'PAUSED';
export type MandateType = 'EXCLUSIVE' | 'CO_EXCLUSIVE' | 'OPEN';
export type MandateStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
export type LeadStage = 'NEW' | 'CONTACTED' | 'VISIT_SCHEDULED' | 'VISITED' | 'OFFER' | 'RESERVED' | 'CLOSED' | 'LOST';
export type CommissionRule = 'A' | 'B' | 'C_EXCLUSIVE' | 'C_OPEN' | 'D';
export type CommissionStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'DISPUTED' | 'RESOLVED';
export type VisitStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  phone_mobile: string | null;
  role: UserRole;
  avatar_url: string | null;
  license_number: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  owner_id: string | null;
  broker_id: string | null;
  title: string;
  description: string | null;
  type: PropertyType | null;
  operation: OperationType | null;
  price: number;
  currency: string;
  address_street: string | null;
  address_city: string | null;
  address_province: string | null;
  address_lat: number | null;
  address_lng: number | null;
  surface_total: number | null;
  surface_covered: number | null;
  rooms: number | null;
  bathrooms: number | null;
  parking: number | null;
  amenities: Record<string, any>;
  status: PropertyStatus;
  dedup_score: number | null;
  dedup_group_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyPhoto {
  id: string;
  property_id: string;
  url: string;
  is_cover: boolean;
  order_index: number;
}

export interface Mandate {
  id: string;
  property_id: string;
  broker_id: string;
  owner_id: string;
  type: MandateType | null;
  commission_pct: number;
  start_date: string;
  end_date: string | null;
  signed_at: string | null;
  owner_signature_url: string | null;
  status: MandateStatus;
  notes: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  property_id: string;
  client_id: string;
  capturing_broker_id: string | null;
  client_broker_id: string | null;
  stage: LeadStage;
  commission_rule: CommissionRule | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface Visit {
  id: string;
  lead_id: string;
  scheduled_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  feedback_client: string | null;
  feedback_broker: string | null;
  status: VisitStatus;
  created_at: string;
}

export interface Message {
  id: string;
  lead_id: string;
  sender_id: string;
  body: string;
  is_filtered: boolean;
  filter_reason: string | null;
  read_at: string | null;
  created_at: string;
}

export interface Commission {
  id: string;
  lead_id: string;
  property_id: string;
  rule: string;
  total_amount: number;
  capturing_broker_pct: number;
  client_broker_pct: number;
  platform_pct: number;
  capturing_broker_amount: number | null;
  client_broker_amount: number | null;
  platform_amount: number | null;
  status: CommissionStatus;
  disputed_by: string | null;
  dispute_reason: string | null;
  dispute_evidence: Record<string, any> | null;
  resolved_at: string | null;
  resolved_by: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  filters_json: Record<string, any>;
  alert_enabled: boolean;
  last_notified_at: string | null;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, any> | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}
