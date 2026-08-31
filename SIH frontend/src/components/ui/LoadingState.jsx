import { SkeletonPreloader } from './SkeletonPreloader.jsx';

export const LoadingState = ({ message = 'Loading MPLADS data...' }) => {
  return <SkeletonPreloader message={message} />;
};

export default LoadingState;
