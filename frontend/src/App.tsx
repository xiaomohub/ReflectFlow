import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Sources from './pages/Sources';
import Inbox from './pages/Inbox';
import Contexts from './pages/Contexts';
import Decisions from './pages/Decisions';
import DecisionDetail from './pages/DecisionDetail';
import Review from './pages/Review';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/contexts" element={<Contexts />} />
          <Route path="/decisions" element={<Decisions />} />
          <Route path="/decisions/new" element={<DecisionDetail />} />
          <Route path="/decisions/:id" element={<DecisionDetail />} />
          <Route path="/review" element={<Review />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
