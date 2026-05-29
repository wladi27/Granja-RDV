'use client';

import { useEffect, useState } from 'react';
import { getUserDashboard } from '@/services/api';
import { UserDashboard } from '@/types/domain';

interface UseDashboardState {
  loading: boolean;
  data: UserDashboard | null;
  error: string | null;
}

export function useDashboard(userId: string) {
  const [state, setState] = useState<UseDashboardState>({
    loading: true,
    data: null,
    error: null,
  });

  const isValidUserId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);

  useEffect(() => {
    let mounted = true;

    if (!isValidUserId) {
      setState({
        loading: false,
        data: null,
        error: 'Invalid dashboard user id',
      });
      return () => {
        mounted = false;
      };
    }

    getUserDashboard(userId)
      .then((data) => {
        if (!mounted) {
          return;
        }
        setState({ loading: false, data, error: null });
      })
      .catch((error: Error) => {
        if (!mounted) {
          return;
        }
        setState({ loading: false, data: null, error: error.message });
      });

    return () => {
      mounted = false;
    };
  }, [isValidUserId, userId]);

  return state;
}
