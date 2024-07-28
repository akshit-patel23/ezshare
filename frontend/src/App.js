import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Sender from './components/Sender';
import Receiver from './components/Receiver';

import './App.css';
import Navbar from './components/Navbar';

function App() {
  return (
   <Router>
    <div className="App">
      <Navbar/>
      <Routes>
        <Route path="/" element={<Sender/>}/>
        <Route path="/receiver" element={<Receiver/>}/>
      </Routes>
    </div>
   </Router>
  );
}

export default App;
