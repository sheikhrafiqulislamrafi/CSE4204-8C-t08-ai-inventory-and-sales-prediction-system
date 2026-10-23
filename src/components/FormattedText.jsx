import React from 'react';

export default function FormattedText({ text }) {
  if (!text) return null;
  const parts = text.split('**');
  return (
    <>
      {parts.map((part, index) => 
        index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>
      )}
    </>
  );
}
