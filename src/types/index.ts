export type UserRole = 'USER' | 'ADMIN';

export interface User {
  id: string;
  displayId?: string;
  idPendaki?: string;
  id_pendaki?: string;
  name: string;
  email: string;
  role: UserRole;
  citizenship?: string;
  identityType?: string;
  nik?: string;
  phone?: string;
  emergencyPhone?: string;
  gender?: 'Laki-laki' | 'Perempuan';
  weight?: string;
  height?: string;
  province?: string;
  city?: string;
  district?: string;
  subdistrict?: string;
  address?: string;
  username?: string;
  password?: string;
}

export interface Pos {
  id: number;
  name: string;
  elevation: number;
  distanceFromBase: number; // in km
  coords?: [number, number];
  desc?: string;
}

export interface RegistrationRequest {
  id?: number;
  userId: string;
  name: string;
  nik: string;
  phone: string;
  emergencyPhone: string;
  birthDate: string;
  address: string;
  gender: 'Laki-laki' | 'Perempuan';
  mountain: string;
  date: string;
  endDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  isLeader?: boolean;
  members?: { id: string; name: string }[];
  checkedGears?: string[];
}

export type SimaksiStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'checkin' | 'checkout' | 'selesai';

export interface SimaksiRequest {
  id?: number;
  ketuaUserId: string;
  ketuaName?: string;
  gunungId: number;
  tanggalNaik: string;
  tanggalTurun: string;
  status: SimaksiStatus;
  createdAt: string;
  members: { id: string; name: string }[];
  synced?: boolean;
  simaksiId?: number;
}

export interface Ticket {
  id: string;
  userId: string;
  mountainName: string;
  date: string;
  endDate: string;
  status: 'PENDING' | 'ACTIVE' | 'COMPLETED';
  qrCode: string;
}

export interface ScanLog {
  id?: number;
  ticketId: string;
  timestamp: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'POST_CHECK';
  posId: number; // ID pos tempat scan dilakukan
  synced: boolean;
}

export interface HikeStats {
  activeHikers: number;
  averageTime: string; // "5h 20m"
}
