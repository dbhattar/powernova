import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { StatsCard } from '@/components/admin/StatsCard';
import { CreateUserModal } from '@/components/admin/CreateUserModal';
import { EditUserModal } from '@/components/admin/EditUserModal';
import { adminService } from '@/lib/adminApi';
import type { AdminUser, UserCreate, UserUpdate } from '@/types/admin';
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  RefreshCw,
  Search,
  Shield,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await adminService.getUsers();
      setUsers(data);
      setFilteredUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    let filtered = users;

    // Filter by active status
    if (filterActive === 'active') {
      filtered = filtered.filter(u => u.is_active);
    } else if (filterActive === 'inactive') {
      filtered = filtered.filter(u => !u.is_active);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u =>
        u.email.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query) ||
        (u.full_name && u.full_name.toLowerCase().includes(query))
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery, filterActive]);

  const handleCreateUser = async (user: UserCreate) => {
    const result = await adminService.createUser(user);
    setSuccessMessage(`User "${result.username}" created successfully${!user.password ? '. Password has been sent to the user.' : ''}`);
    setTimeout(() => setSuccessMessage(''), 5000);
    loadUsers();
  };

  const handleUpdateUser = async (id: number, user: UserUpdate) => {
    await adminService.updateUser(id, user);
    setSuccessMessage('User updated successfully');
    setTimeout(() => setSuccessMessage(''), 5000);
    loadUsers();
  };

  const handleResetPassword = async (id: number) => {
    return await adminService.resetUserPassword(id);
  };

  const handleDeleteUser = async (user: AdminUser) => {
    if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      return;
    }

    try {
      await adminService.deleteUser(user.id);
      setSuccessMessage(`User "${user.username}" deleted successfully`);
      setTimeout(() => setSuccessMessage(''), 5000);
      loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleEditClick = (user: AdminUser) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const activeUsers = users.filter(u => u.is_active).length;
  const inactiveUsers = users.filter(u => !u.is_active).length;
  const superUsers = users.filter(u => u.is_superuser).length;

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">Manage user accounts and permissions</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadUsers}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Create User
            </button>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-600">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard
            title="Total Users"
            value={users.length}
            icon={<Users className="w-5 h-5" />}
          />
          <StatsCard
            title="Active Users"
            value={activeUsers}
            className="border-l-4 border-l-green-500"
            icon={<CheckCircle className="w-5 h-5 text-green-600" />}
          />
          <StatsCard
            title="Inactive Users"
            value={inactiveUsers}
            className="border-l-4 border-l-gray-500"
            icon={<XCircle className="w-5 h-5 text-gray-600" />}
          />
          <StatsCard
            title="Super Users"
            value={superUsers}
            className="border-l-4 border-l-purple-500"
            icon={<Shield className="w-5 h-5 text-purple-600" />}
          />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email, username, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterActive('all')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filterActive === 'all'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterActive('active')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filterActive === 'active'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilterActive('inactive')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filterActive === 'inactive'
                    ? 'bg-gray-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="font-medium text-gray-900">{user.username}</div>
                        {user.full_name && (
                          <div className="text-sm text-gray-500">{user.full_name}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {user.is_superuser && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                          <Shield className="w-3 h-3" />
                          Super
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditClick(user)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit user"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredUsers.length === 0 && !isLoading && (
              <div className="text-center py-12 text-gray-500">
                {searchQuery || filterActive !== 'all'
                  ? 'No users found matching your filters'
                  : 'No users yet. Create your first user!'}
              </div>
            )}

            {isLoading && (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateUser}
      />
      <EditUserModal
        isOpen={showEditModal}
        user={selectedUser}
        onClose={() => {
          setShowEditModal(false);
          setSelectedUser(null);
        }}
        onSubmit={handleUpdateUser}
        onResetPassword={handleResetPassword}
      />
    </AdminLayout>
  );
}
