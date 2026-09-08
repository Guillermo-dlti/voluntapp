export interface Activity {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  location: string;
  description: string;
  requirements: string[];
  spotsLeft: number;
  capacity: number;
  status: 'abierta' | 'llena' | 'finalizada';
}

export interface Registration {
  id: string;
  activityId: string;
  activityTitle: string;
  dateText: string;
  timeText: string;
  location: string;
  status: 'confirmada' | 'asistio' | 'cancelada';
  checkInCode: string;
}

export interface VolunteerProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  hoursTotal: number;
  completedServices: number;
  rescuedKg: number;
}

export const CURRENT_VOLUNTEER: VolunteerProfile = {
  id: 'vol-1',
  name: 'Carlos Ruiz',
  email: 'carlos.ruiz@ejemplo.com',
  phone: '+52 (33) 1234-5678',
  role: 'Voluntario Activo BAMX',
  hoursTotal: 32,
  completedServices: 8,
  rescuedKg: 140,
};

export const MOCK_ACTIVITIES: Activity[] = [
  {
    id: 'act-1',
    title: 'Colecta Central de Alimentos',
    category: 'Colecta',
    date: 'Sábado, 12 Octubre',
    time: '08:00 - 12:00',
    location: 'Centro Guadalajara',
    description: 'Recepción, pesado y organización de donaciones de alimentos no perecederos provenientes de comercios y donantes locales.',
    requirements: ['Ropa cómoda', 'Calzado cerrado', 'Identificación oficial'],
    spotsLeft: 6,
    capacity: 15,
    status: 'abierta',
  },
  {
    id: 'act-2',
    title: 'Clasificación de Productos',
    category: 'Almacén',
    date: 'Lunes, 14 Octubre',
    time: '09:00 - 13:00',
    location: 'Almacén Norte',
    description: 'Selección y empaquetado de frutas, verduras y abarrotes en despensas nutritivas para familias en situación vulnerable.',
    requirements: ['Puntualidad', 'Uso de red para cabello (proporcionada)', 'Calzado cerrado'],
    spotsLeft: 4,
    capacity: 12,
    status: 'abierta',
  },
  {
    id: 'act-3',
    title: 'Distribución en Comunidad',
    category: 'Entrega',
    date: 'Miércoles, 16 Octubre',
    time: '10:00 - 14:00',
    location: 'Centro Comunitario Polanco',
    description: 'Apoyo logístico y de atención ciudadana en la entrega directa de despensas a beneficiarios empadronados.',
    requirements: ['Ganas de servir', 'Identificación oficial', 'Gorra / protector solar'],
    spotsLeft: 8,
    capacity: 20,
    status: 'abierta',
  },
];

export const MOCK_UPCOMING_ACTIVITIES: Registration[] = [
  {
    id: 'reg-1',
    activityId: 'act-2',
    activityTitle: 'Clasificación de Alimentos',
    dateText: 'Mañana',
    timeText: '09:00h',
    location: 'Almacén Norte',
    status: 'confirmada',
    checkInCode: 'BAMX-CR-20261014-01',
  },
];

export const MOCK_PAST_ACTIVITIES: Registration[] = [
  {
    id: 'reg-past-1',
    activityId: 'act-past-1',
    activityTitle: 'Colecta Anual BAMX',
    dateText: '15 Sep 2026',
    timeText: '4 horas completadas',
    location: 'Plaza Mayor',
    status: 'asistio',
    checkInCode: 'BAMX-CR-20260915-02',
  },
  {
    id: 'reg-past-2',
    activityId: 'act-past-2',
    activityTitle: 'Armado de Despensas',
    dateText: '28 Ago 2026',
    timeText: '4 horas completadas',
    location: 'Almacén Central',
    status: 'asistio',
    checkInCode: 'BAMX-CR-20260828-03',
  },
];
