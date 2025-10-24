import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-primary text-white py-4 mt-auto">
      <div className="container mx-auto px-4 text-center text-sm">
        <p>
          © {new Date().getFullYear()} SportsOnCourts. All rights reserved.
        </p>
        <p className="mt-1 text-xs text-primary-light">
          Built with React & FastAPI — <a href="https://github.com/your-org/courtvision-analytics" target="_blank" rel="noopener noreferrer" className="underline">GitHub</a>
        </p>
      </div>
    </footer>
  );
};
