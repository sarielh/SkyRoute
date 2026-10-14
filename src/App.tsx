import { useEffect } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from './common/toast';
import { AppProvider } from './context/AppContext';
import { BookingFlowProvider } from './context/BookingFlowContext';
import { Layout } from './components/Layout';
import { BookingDetailsPage } from './pages/BookingDetailsPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { HomePage } from './pages/HomePage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PassengersPage } from './pages/PassengersPage';
import { ResultsPage } from './pages/ResultsPage';
import { ReviewPage } from './pages/ReviewPage';
import { ResetTestDataPage } from './pages/ResetTestDataPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AppProvider>
          <BookingFlowProvider>
            <ScrollToTop />
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="search" element={<ResultsPage />} />
                <Route path="booking/passengers" element={<PassengersPage />} />
                <Route path="booking/review" element={<ReviewPage />} />
                <Route path="booking/confirmation/:reference" element={<ConfirmationPage />} />
                <Route path="bookings" element={<MyBookingsPage />} />
                <Route path="bookings/:reference" element={<BookingDetailsPage />} />
                <Route path="reset-test" element={<ResetTestDataPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BookingFlowProvider>
        </AppProvider>
      </ToastProvider>
    </HashRouter>
  );
}
