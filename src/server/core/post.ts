import { reddit } from '@devvit/web/server';

export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: 'biddymod',
  });
};

export const createModQueuePost = async () => {
  return await reddit.submitCustomPost({
    title: 'biddyMOD — Mod Queue',
    entry: 'modqueue',
  });
};