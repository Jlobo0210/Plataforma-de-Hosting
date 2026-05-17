import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './pages/App.jsx'
import ServiceDetail from './pages/ServiceDetail.jsx'
import './index.css'

export default function Main() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/services/:id" element={<ServiceDetail />} />
      </Routes>
    </BrowserRouter>
  )
}