import {
  Bell,
  Books,
  CalendarDots,
  ChartLineUp,
  ChatsCircle,
  CheckSquareOffset,
  SunHorizon,
  Timer,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react';

const item = (to, label, icon, extra = {}) => ({ to, label, icon, ...extra });

export const NAV = {
  today: item('/', 'Hoy', SunHorizon, { end: true }),
  tasks: item('/tareas', 'Tareas', CheckSquareOffset),
  calendar: item('/calendario', 'Calendario', CalendarDots),
  subjects: item('/asignaturas', 'Asignaturas', Books),
  grades: item('/notas', 'Notas', ChartLineUp),
  rooms: item('/salas', 'Salas', ChatsCircle),
  friends: item('/amigos', 'Amigos', UsersThree),
  pomodoro: item('/pomodoro', 'Pomodoro', Timer),
  notifications: item('/avisos', 'Avisos', Bell),
  profile: item('/perfil', 'Perfil', UserCircle),
};

// Escritorio y tablet: grupos del rail lateral.
export const NAV_GROUPS = [
  { label: 'Tu semestre', items: [NAV.today, NAV.tasks, NAV.calendar, NAV.subjects, NAV.grades] },
  { label: 'Con otros', items: [NAV.rooms, NAV.friends] },
  { label: 'Foco', items: [NAV.pomodoro] },
];

// Móvil: lo diario en la barra inferior, el resto en la hoja "Más".
export const MOBILE_TABS = [NAV.today, NAV.tasks, NAV.calendar, NAV.rooms];
export const MORE_ITEMS = [NAV.subjects, NAV.grades, NAV.friends, NAV.pomodoro, NAV.notifications, NAV.profile];

// Páginas donde el botón flotante de "nueva tarea" tiene sentido en móvil.
export const QUICK_ADD_PATHS = ['/', '/tareas', '/calendario'];
