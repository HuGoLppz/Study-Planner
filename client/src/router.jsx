import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout.jsx";
import { AuthLayout } from "./layouts/AuthLayout.jsx";
import { GuestOnly, RequireAuth } from "./layouts/RouteGuards.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

// Las páginas privadas se cargan bajo demanda para que la primera carga sea ligera.
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const TasksPage = lazy(() => import("./pages/TasksPage.jsx"));
const CalendarPage = lazy(() => import("./pages/CalendarPage.jsx"));
const SubjectsPage = lazy(() => import("./pages/SubjectsPage.jsx"));
const GradesPage = lazy(() => import("./pages/GradesPage.jsx"));
const FriendsPage = lazy(() => import("./pages/FriendsPage.jsx"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage.jsx"));
const RoomsPage = lazy(() => import("./pages/RoomsPage.jsx"));
const RoomPage = lazy(() => import("./pages/RoomPage.jsx"));
const PomodoroPage = lazy(() => import("./pages/PomodoroPage.jsx"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.jsx"));
const ProfilePage = lazy(() => import("./pages/ProfilePage.jsx"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage.jsx"));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route element={<AuthLayout />}>
          <Route path="/entrar" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />
        </Route>
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/tareas" element={<TasksPage />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/asignaturas" element={<SubjectsPage />} />
          <Route path="/notas" element={<GradesPage />} />
          <Route path="/amigos" element={<FriendsPage />} />
          <Route path="/u/:handle" element={<UserProfilePage />} />
          <Route path="/salas" element={<RoomsPage />} />
          <Route path="/salas/:roomId" element={<RoomPage />} />
          <Route path="/pomodoro" element={<PomodoroPage />} />
          <Route path="/avisos" element={<NotificationsPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
