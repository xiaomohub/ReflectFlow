import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Sources from './pages/Sources';
import Inbox from './pages/Inbox';
import Contexts from './pages/Contexts';
import Decisions from './pages/Decisions';
import NewDecision from './pages/NewDecision';
import DecisionDetail from './pages/DecisionDetail';
import Review from './pages/Review';
import Notes from './pages/Notes';
import NoteEditor from './pages/NoteEditor';
import Users from './pages/Users';

function Page({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Page><Dashboard /></Page>} />
          <Route path="/sources" element={<Page><Sources /></Page>} />
          <Route path="/inbox" element={<Page><Inbox /></Page>} />
          <Route path="/contexts" element={<Page><Contexts /></Page>} />
          <Route path="/decisions" element={<Page><Decisions /></Page>} />
          <Route path="/decisions/new" element={<Page><NewDecision /></Page>} />
          <Route path="/decisions/:id" element={<Page><DecisionDetail /></Page>} />
          <Route path="/notes" element={<Page><Notes /></Page>} />
          <Route path="/notes/new" element={<Page><NoteEditor /></Page>} />
          <Route path="/notes/:id" element={<Page><NoteEditor /></Page>} />
          <Route path="/review" element={<Page><Review /></Page>} />
          <Route path="/users" element={<Page><Users /></Page>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
