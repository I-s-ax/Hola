import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../components/DashboardLayout';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Image, Loader2, ChevronLeft, ChevronRight, Globe, Lock, Pencil, Trash2 } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CardsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cover_url: '',
    is_public: false
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchCards = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/cards`, {
        params: {
          user_id: user.user_id,
          page,
          per_page: 6
        }
      });
      setCards(response.data.data || []);
      setTotalPages(response.data.total_pages || 1);
    } catch (error) {
      console.error('Error fetching cards:', error);
      toast.error('Error al cargar las tarjetas');
    } finally {
      setLoading(false);
    }
  }, [user, page]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/cards`, {
        user_id: user.user_id,
        ...formData
      });
      toast.success('Tarjeta creada exitosamente');
      setIsCreateOpen(false);
      setFormData({ title: '', description: '', cover_url: '', is_public: false });
      fetchCards();
    } catch (error) {
      toast.error('Error al crear la tarjeta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editingCard) return;

    setSubmitting(true);
    try {
      await axios.put(`${API}/cards/${editingCard.card_id}`, {
        user_id: user.user_id,
        ...formData
      });
      toast.success('Tarjeta actualizada');
      setIsEditOpen(false);
      setEditingCard(null);
      fetchCards();
    } catch (error) {
      toast.error('Error al actualizar la tarjeta');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (cardId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta tarjeta?')) return;

    try {
      await axios.delete(`${API}/cards/${cardId}?user_id=${user.user_id}`);
      toast.success('Tarjeta eliminada');
      fetchCards();
    } catch (error) {
      toast.error('Error al eliminar la tarjeta');
    }
  };

  const openEditDialog = (card) => {
    setEditingCard(card);
    setFormData({
      title: card.title,
      description: card.description || '',
      cover_url: card.cover_url || '',
      is_public: card.is_public === 1
    });
    setIsEditOpen(true);
  };

  const CardForm = ({ onSubmit, isEdit = false }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title" className="text-zinc-300">Título *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="Nombre de la tarjeta"
          className="bg-zinc-900/50 border-zinc-800 text-white"
          required
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-zinc-300">Descripción</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descripción opcional"
          className="bg-zinc-900/50 border-zinc-800 text-white resize-none"
          rows={3}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cover_url" className="text-zinc-300">Portada</Label>
        <div className="space-y-2">
          <Input
            id="cover_url"
            value={formData.cover_url}
            onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })}
            placeholder="URL de imagen (opcional)"
            className="bg-zinc-900/50 border-zinc-800 text-white"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <p className="text-xs text-zinc-500">O deja vacío para tarjeta sin portada</p>
        </div>
        {formData.cover_url && (
          <img 
            src={formData.cover_url} 
            alt="Preview" 
            className="mt-2 w-full h-32 object-cover rounded-lg"
            onError={(e) => e.target.style.display = 'none'}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Switch
            id="is_public"
            checked={formData.is_public}
            onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
          />
          <Label htmlFor="is_public" className="text-zinc-300 flex items-center gap-2">
            {formData.is_public ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            {formData.is_public ? 'Pública' : 'Privada'}
          </Label>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-primary text-white hover:bg-primary/90"
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {isEdit ? 'Guardando...' : 'Creando...'}
          </>
        ) : (
          isEdit ? 'Guardar Cambios' : 'Crear Tarjeta'
        )}
      </Button>
    </form>
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6" data-testid="cards-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Mis Tarjetas</h1>
            <p className="text-zinc-400">Organiza tu contenido multimedia</p>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button 
                className="bg-primary text-white hover:bg-primary/90"
                data-testid="create-card-btn"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Tarjeta
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="bg-[#18181B] border-zinc-800 max-h-[90vh] overflow-y-auto"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle className="text-white">Crear Nueva Tarjeta</DialogTitle>
              </DialogHeader>
              <CardForm onSubmit={handleCreate} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : cards.length === 0 ? (
          <Card className="bg-[#18181B] border-zinc-800">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Image className="w-12 h-12 text-zinc-600 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No hay tarjetas</h3>
              <p className="text-zinc-400 mb-4">Crea tu primera tarjeta para comenzar</p>
              <Button
                onClick={() => setIsCreateOpen(true)}
                className="bg-primary text-white hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Tarjeta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cards.map((card) => (
                <Card 
                  key={card.card_id} 
                  className="bg-[#18181B] border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer group overflow-hidden"
                  data-testid={`card-${card.card_id}`}
                >
                  <div 
                    onClick={() => navigate(`/cards/${card.card_id}`)}
                    className="relative"
                  >
                    {card.cover_url ? (
                      <div className="aspect-video w-full overflow-hidden">
                        <img 
                          src={card.cover_url} 
                          alt={card.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video w-full bg-zinc-900 flex items-center justify-center">
                        <Image className="w-12 h-12 text-zinc-700" />
                      </div>
                    )}
                    
                    {/* Badge público/privado */}
                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                        card.is_public 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-zinc-700/50 text-zinc-400'
                      }`}>
                        {card.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                        {card.is_public ? 'Pública' : 'Privada'}
                      </span>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0" onClick={() => navigate(`/cards/${card.card_id}`)}>
                        <h3 className="font-semibold text-white truncate">{card.title}</h3>
                        {card.description && (
                          <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{card.description}</p>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditDialog(card);
                          }}
                          className="text-zinc-400 hover:text-white"
                          data-testid={`edit-card-${card.card_id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(card.card_id);
                          }}
                          className="text-zinc-400 hover:text-red-400"
                          data-testid={`delete-card-${card.card_id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-zinc-700 text-zinc-300"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
                <span className="text-zinc-400">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="border-zinc-700 text-zinc-300"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent 
            className="bg-[#18181B] border-zinc-800 max-h-[90vh] overflow-y-auto"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-white">Editar Tarjeta</DialogTitle>
            </DialogHeader>
            <CardForm onSubmit={handleEdit} isEdit />
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default CardsPage;
