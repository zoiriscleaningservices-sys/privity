import React, { useState } from 'react';
import { Gift, GiftCategory, GiftRarity } from './types';
import { saveGiftsCatalog } from './defaultGifts';

export interface AdminGiftManagerProps {
  catalog: Gift[];
  onCatalogChange: (newCatalog: Gift[]) => void;
  triggerToast?: (msg: string) => void;
}

export const AdminGiftManager: React.FC<AdminGiftManagerProps> = ({
  catalog,
  onCatalogChange,
  triggerToast,
}) => {
  const [editingGift, setEditingGift] = useState<Gift | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  const [formState, setFormState] = useState<{
    id: string;
    name: string;
    description: string;
    icon: string;
    animationUrl: string;
    webmUrl: string;
    coinCost: number;
    category: GiftCategory;
    rarity: GiftRarity;
    animationDuration: number;
    enabled: boolean;
    soundUrl: string;
    priority: number;
  }>({
    id: '',
    name: '',
    description: '',
    icon: '',
    animationUrl: '',
    webmUrl: '',
    coinCost: 100,
    category: 'special',
    rarity: 'common',
    animationDuration: 4000,
    enabled: true,
    soundUrl: '',
    priority: 1,
  });

  const handleOpenEdit = (gift: Gift) => {
    setIsCreatingNew(false);
    setEditingGift(gift);
    setFormState({
      id: gift.id,
      name: gift.name,
      description: gift.description || '',
      icon: gift.icon,
      animationUrl: gift.animationUrl,
      webmUrl: gift.webmUrl || '',
      coinCost: gift.coinCost,
      category: gift.category,
      rarity: gift.rarity,
      animationDuration: gift.animationDuration,
      enabled: gift.enabled,
      soundUrl: gift.soundUrl || '',
      priority: gift.priority || 1,
    });
  };

  const handleOpenCreate = () => {
    setIsCreatingNew(true);
    setEditingGift(null);
    setFormState({
      id: `gift-${Date.now().toString(36)}`,
      name: '',
      description: '',
      icon: './gifts/rose/icon.webp',
      animationUrl: './gifts/rose/animation.apng',
      webmUrl: './gifts/rose/animation.webm',
      coinCost: 500,
      category: 'premium',
      rarity: 'epic',
      animationDuration: 5000,
      enabled: true,
      soundUrl: '',
      priority: 3,
    });
  };

  const handleToggleEnabled = (giftId: string) => {
    const updated = catalog.map((g) => (g.id === giftId ? { ...g, enabled: !g.enabled } : g));
    onCatalogChange(updated);
    saveGiftsCatalog(updated);
    triggerToast?.('Gift status updated');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.id.trim() || !formState.name.trim()) {
      alert('Please provide Gift ID and Name');
      return;
    }

    const newGift: Gift = {
      ...formState,
      coinCost: Number(formState.coinCost),
      animationDuration: Number(formState.animationDuration),
      priority: Number(formState.priority),
    };

    let updated: Gift[];
    if (isCreatingNew) {
      if (catalog.some((g) => g.id === newGift.id)) {
        alert(`A gift with ID '${newGift.id}' already exists.`);
        return;
      }
      updated = [newGift, ...catalog];
      triggerToast?.(`Created new gift '${newGift.name}'`);
    } else {
      updated = catalog.map((g) => (g.id === newGift.id ? newGift : g));
      triggerToast?.(`Updated gift '${newGift.name}'`);
    }

    onCatalogChange(updated);
    saveGiftsCatalog(updated);
    setEditingGift(null);
    setIsCreatingNew(false);
  };

  return (
    <div className="admin-gift-manager-container">
      <div className="admin-gift-manager-header">
        <div>
          <h3 className="admin-section-title">Virtual Gifts & Battle Boosters Engine</h3>
          <p className="admin-section-subtitle">
            Configure dynamic gifts, coin economics, transparent APNG/WebM animations, and priorities.
          </p>
        </div>
        <button type="button" className="btn-create-gift" onClick={handleOpenCreate}>
          + Create New Gift
        </button>
      </div>

      {/* Gifts Table */}
      <div className="admin-gifts-table-wrap">
        <table className="admin-gifts-table">
          <thead>
            <tr>
              <th>Preview</th>
              <th>Name & ID</th>
              <th>Category</th>
              <th>Rarity</th>
              <th>Cost (Coins)</th>
              <th>Duration</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((gift) => (
              <tr key={gift.id} className={!gift.enabled ? 'row-disabled' : ''}>
                <td>
                  <div className="admin-gift-thumb-box">
                    <img src={gift.icon} alt={gift.name} className="admin-gift-thumb" />
                  </div>
                </td>
                <td>
                  <div className="gift-table-title">{gift.name}</div>
                  <div className="gift-table-sub">ID: {gift.id}</div>
                </td>
                <td>
                  <span className="admin-category-pill">{gift.category}</span>
                </td>
                <td>
                  <span className={`admin-rarity-pill ${gift.rarity}`}>{gift.rarity}</span>
                </td>
                <td>
                  <strong>🪙 {gift.coinCost.toLocaleString()}</strong>
                </td>
                <td>{(gift.animationDuration / 1000).toFixed(1)}s</td>
                <td>P{gift.priority || 1}</td>
                <td>
                  <span className={`admin-status-badge ${gift.enabled ? 'active' : 'inactive'}`}>
                    {gift.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td>
                  <div className="admin-actions-group">
                    <button
                      type="button"
                      className="btn-edit-action"
                      onClick={() => handleOpenEdit(gift)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-toggle-action"
                      onClick={() => handleToggleEnabled(gift.id)}
                    >
                      {gift.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit / Create Modal */}
      {(editingGift || isCreatingNew) && (
        <div className="admin-edit-modal-backdrop" onClick={() => { setEditingGift(null); setIsCreatingNew(false); }}>
          <div className="admin-edit-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h4>{isCreatingNew ? 'Create New Animated Gift' : `Edit Gift: ${editingGift?.name}`}</h4>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => { setEditingGift(null); setIsCreatingNew(false); }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="admin-modal-form">
              <div className="form-grid-row">
                <div className="form-col">
                  <label>Gift ID (Unique identifier)</label>
                  <input
                    type="text"
                    required
                    value={formState.id}
                    disabled={!isCreatingNew}
                    onChange={(e) => setFormState({ ...formState, id: e.target.value })}
                  />
                </div>
                <div className="form-col">
                  <label>Display Name</label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-col">
                <label>Description</label>
                <input
                  type="text"
                  value={formState.description}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                />
              </div>

              <div className="form-grid-row">
                <div className="form-col">
                  <label>Coin Cost (Tokens)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formState.coinCost}
                    onChange={(e) => setFormState({ ...formState, coinCost: Number(e.target.value) })}
                  />
                </div>
                <div className="form-col">
                  <label>Category</label>
                  <select
                    value={formState.category}
                    onChange={(e) => setFormState({ ...formState, category: e.target.value as GiftCategory })}
                  >
                    <option value="love">Love ❤️</option>
                    <option value="premium">Premium 🌌</option>
                    <option value="fantasy">Fantasy 🐉</option>
                    <option value="fun">Fun 🦟</option>
                    <option value="special">Special ✨</option>
                  </select>
                </div>
                <div className="form-col">
                  <label>Rarity</label>
                  <select
                    value={formState.rarity}
                    onChange={(e) => setFormState({ ...formState, rarity: e.target.value as GiftRarity })}
                  >
                    <option value="common">Common</option>
                    <option value="uncommon">Uncommon</option>
                    <option value="rare">Rare</option>
                    <option value="epic">Epic</option>
                    <option value="special">Special</option>
                    <option value="legendary">Legendary</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-row">
                <div className="form-col">
                  <label>Animation Duration (ms)</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={formState.animationDuration}
                    onChange={(e) => setFormState({ ...formState, animationDuration: Number(e.target.value) })}
                  />
                </div>
                <div className="form-col">
                  <label>Queue Priority (1-5)</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={formState.priority}
                    onChange={(e) => setFormState({ ...formState, priority: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-col">
                <label>Transparent APNG Animation URL</label>
                <input
                  type="text"
                  required
                  value={formState.animationUrl}
                  onChange={(e) => setFormState({ ...formState, animationUrl: e.target.value })}
                />
              </div>

              <div className="form-col">
                <label>Transparent WebM Alpha Video URL (Optional, for 60fps hardware acceleration)</label>
                <input
                  type="text"
                  value={formState.webmUrl}
                  onChange={(e) => setFormState({ ...formState, webmUrl: e.target.value })}
                />
              </div>

              <div className="form-grid-row">
                <div className="form-col">
                  <label>Icon URL (WebP / PNG)</label>
                  <input
                    type="text"
                    required
                    value={formState.icon}
                    onChange={(e) => setFormState({ ...formState, icon: e.target.value })}
                  />
                </div>
                <div className="form-col">
                  <label>Sound FX URL (MP3)</label>
                  <input
                    type="text"
                    value={formState.soundUrl}
                    onChange={(e) => setFormState({ ...formState, soundUrl: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => { setEditingGift(null); setIsCreatingNew(false); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-save-primary">
                  {isCreatingNew ? 'Create Gift' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
