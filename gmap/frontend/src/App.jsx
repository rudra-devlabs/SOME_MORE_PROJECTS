// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
import logo from './assets/logo.png'
import './App.css'
import Silk from './component/Silk.jsx'
import CardNav from './component/CardNav.jsx'
import {Input} from "@heroui/input";

function App() {
  const items = [
    {
      label: "About",
      bgColor: "#0D0716",
      textColor: "#fff",
      links: [
        { label: "Company", ariaLabel: "About Company" },
        { label: "Careers", ariaLabel: "About Careers" }
      ]
    },
    {
      label: "Projects", 
      bgColor: "#170D27",
      textColor: "#fff",
      links: [
        { label: "Featured", ariaLabel: "Featured Projects" },
        { label: "Case Studies", ariaLabel: "Project Case Studies" }
      ]
    }
  ];
  return <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
    {/* <Silk
      speed={5}
      scale={1}
      color="#311070"
      noiseIntensity={1.5}
      rotation={0}
    />
    <CardNav
      logo={logo}
      logoAlt="Company Logo"
      items={items}
      baseColor="tranparent"
      menuColor="#fff"
      buttonBgColor="#fff"
      buttonTextColor="#111"
      ease="elastic.out(1, 0.8)"
      theme="dark"/> */}
      <Input label="Email" type="email" />
      <Input label="Email" placeholder="Enter your email" type="email" />
  </div>

}

export default App
