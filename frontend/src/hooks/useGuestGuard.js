import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

/**
 * Hook that returns a guard function for guest users.
 * Wrap any write action (add/edit/delete) with guardAction().
 * If guest → shows toast and blocks the action.
 * If not guest → runs the action normally.
 */
export const useGuestGuard = () => {
  const { isGuest } = useAuth();
  const { addToast } = useToast();

  const blockGuestAction = () => {
    if (isGuest) {
      addToast('Guest users have view-only access', 'error');
      return true;
    }
    return false;
  };

  const guardAction = (callback) => {
    if (blockGuestAction()) return false;
    if (typeof callback === 'function') callback();
    return true;
  };

  return { isGuest, guardAction, blockGuestAction };
};
