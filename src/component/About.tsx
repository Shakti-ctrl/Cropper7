import React from "react";

import "../App.css";
import A2HSButton from "../A2HSButton";

const About = ({ aboutText, appName, children }: any) => {
  return (
    <div className="about-message" style={{
      background: "linear-gradient(135deg, rgba(0, 20, 40, 0.1), rgba(0, 40, 80, 0.05))",
      borderRadius: "15px",
      border: "1px solid rgba(0, 255, 255, 0.2)",
      boxShadow: "0 0 30px rgba(0, 255, 255, 0.1)",
      backdropFilter: "blur(10px)"
    }}>
      <div className="app-logo" style={{
        background: "linear-gradient(135deg, rgba(0, 40, 80, 0.3), rgba(0, 20, 40, 0.5))",
        padding: "20px",
        borderRadius: "10px",
        border: "2px solid rgba(0, 255, 255, 0.3)",
        marginBottom: "20px"
      }}>{appName}</div>
      <div style={{
        color: "#00bfff",
        fontSize: "1.1em",
        lineHeight: "1.6",
        textAlign: "center",
        marginBottom: "20px"
      }}>{aboutText}</div>
      {children}
    </div>
  );
};

export default About;