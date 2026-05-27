import './index.css';

import { navigateTo } from '@devvit/web/client';
import { context, requestExpandedMode } from '@devvit/web/client';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

export const Splash = () => {
  const isModerator = (context as { isModerator?: boolean }).isModerator;

  return (
    <div className="flex relative flex-col justify-center items-center min-h-screen gap-4 bg-white dark:bg-gray-900">
      <img
        className="object-contain w-1/2 max-w-[250px] mx-auto"
        src="/snoo.png"
        alt="Snoo"
      />
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
          biddyMOD
        </h1>
        <p className="text-base text-center text-gray-600 dark:text-gray-300">
          Moderator queue and AI review for r/{context.subredditName ?? 'your community'}.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 mt-5">
        {/* Existing button */}
        <button
          className="flex items-center justify-center bg-[#d93900] dark:bg-orange-600 text-white w-auto h-10 rounded-full cursor-pointer transition-colors px-4 hover:bg-[#c23300] dark:hover:bg-orange-700"
          onClick={(e) => requestExpandedMode(e.nativeEvent, 'game')}
        >
          Tap to Start
        </button>

        {/* Mod-only queue button — context.isModerator hides it from regular users */}
        {isModerator && (
          <button
            className="flex items-center justify-center bg-gray-800 dark:bg-gray-700 text-white w-auto h-10 rounded-full cursor-pointer transition-colors px-4 hover:bg-gray-700 dark:hover:bg-gray-600 gap-2"
            onClick={(e) => requestExpandedMode(e.nativeEvent, 'modqueue')}
          >
            🛡️ Mod Queue
          </button>
        )}
      </div>

      <footer className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 text-[0.8em] text-gray-600 dark:text-gray-400">
        <button
          className="cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
          onClick={() => navigateTo('https://developers.reddit.com/docs')}
        >
          Docs
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button
          className="cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
          onClick={() => navigateTo('https://www.reddit.com/r/Devvit')}
        >
          r/Devvit
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button
          className="cursor-pointer hover:text-gray-900 dark:hover:text-white transition-colors"
          onClick={() => navigateTo('https://discord.com/invite/R7yu2wh9Qz')}
        >
          Discord
        </button>
      </footer>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
