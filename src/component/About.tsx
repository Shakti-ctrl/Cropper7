import React from "react";

import "../App.css";
import A2HSButton from "../A2HSButton";

const About = ({ aboutText, appName, children }: any) => {
  return (
    <div className="about-message" style={{
      background: "linear-gradient(135deg, rgba(0, 20, 40, 0.15), rgba(0, 40, 80, 0.1))",
      borderRadius: "20px",
      border: "2px solid rgba(0, 255, 255, 0.3)",
      boxShadow: "0 0 40px rgba(0, 255, 255, 0.15)",
      backdropFilter: "blur(15px)",
      padding: "25px",
      marginTop: "20px",
      width: "100%",
      boxSizing: "border-box"
    }}>
      <div className="app-logo" style={{
        background: "linear-gradient(135deg, rgba(0, 40, 80, 0.4), rgba(0, 20, 40, 0.6))",
        padding: "25px",
        borderRadius: "15px",
        border: "2px solid rgba(0, 255, 255, 0.4)",
        marginBottom: "25px",
        fontSize: "1.4em",
        fontWeight: "bold",
        textAlign: "center"
      }}>{appName}</div>
      <div style={{
        color: "#00bfff",
        fontSize: "1.2em",
        lineHeight: "1.7",
        textAlign: "center",
        marginBottom: "25px",
        padding: "0 15px"
      }}>{aboutText}</div>
      {children}
    </div>
  );
};

export default About;