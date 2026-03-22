import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DashboardLayout } from '../components/DashboardLayout';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Upload, 
  Loader2, 
  Image, 
  Video, 
  FileText, 
  Trash2, 
  Globe, 
  Lock,
  Pencil,
  X,
  Link as LinkIcon,
  Download,
  ExternalLink
} from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CardDetailPage = () => {
  const { cardId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cover_url: '',
    is_public: false
  });

  const fetchCard = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/cards/${cardId}`, {
        params: { user_id: user.user_id }
      });
      setCard(response.data);
      setFormData({
        title: response.data.title,
        description: response.data.description || '',
        cover_url: response.data.cover_url || '',
        is_public: response.data.is_public === 1
      });
    } catch (error) {
      console.error('Error fetching card:', error);
      toast.error('Error al cargar la tarjeta');
      navigate('/cards');
    } finally {
      setLoading(false);
    }
  }, [cardId, user, navigate]);

  const checkGoogleConnection = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await axios.get(`${API}/google/status`, {
        params: { user_id: user.user_id }
      });
      setGoogleConnected(response.data.connected);
    } catch (error) {
      console.error('Error checking Google connection:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchCard();
    checkGoogleConnection();
  }, [fetchCard, checkGoogleConnection]);

  const handleConnectGoogle = async () => {
    try {
      const response = await axios.get(`${API}/google/auth`, {
        params: { user_id: user.user_id }
      });
      window.location.href = response.data.auth_url;
    } catch (error) {
      toast.error('Error al conectar con Google');
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('¿Desconectar Google Drive?')) return;
    
    try {
      await axios.post(`${API}/google/disconnect`, { user_id: user.user_id });
      setGoogleConnected(false);
      toast.success('Google Drive desconectado');
    } catch (error) {
      toast.error('Error al desconectar');
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!googleConnected) {
      toast.error('Conecta Google Drive primero');
      return;
    }

    setUploading(true);

    for (const file of files) {
      try {
        // Subir a Google Drive
        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', user.user_id);

        const uploadResponse = await axios.post(`${API}/google/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const uploadedFile = uploadResponse.data.file;

        // Determinar tipo de archivo
        let fileType = 'document';
        if (file.type.startsWith('image/')) fileType = 'image';
        else if (file.type.startsWith('video/')) fileType = 'video';

        // Guardar referencia en la tarjeta
        await axios.post(`${API}/cards/${cardId}/files`, {
          user_id: user.user_id,
          provider: 'google_drive',
          provider_file_id: uploadedFile.id,
          file_name: uploadedFile.name,
          file_type: fileType,
          mime_type: uploadedFile.mimeType,
          thumbnail_url: uploadedFile.thumbnailLink,
          file_size: parseInt(uploadedFile.size || '0')
        });

        toast.success(`${file.name} subido correctamente`);
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Error al subir ${file.name}`);
      }
    }

    setUploading(false);
    fetchCard();
    e.target.value = '';
  };

  const handleDeleteFile = async (fileId, providerFileId) => {
    if (!window.confirm('¿Eliminar este archivo?')) return;

    try {
      await axios.delete(`${API}/cards/${cardId}/files/${fileId}`, {
        params: { 
          user_id: user.user_id,
          delete_from_cloud: 'true'
        }
      });
      toast.success('Archivo eliminado');
      fetchCard();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const handleUpdateCard = async (e) => {
    e.preventDefault();
    
    try {
      await axios.put(`${API}/cards/${cardId}`, {
        user_id: user.user_id,
        ...formData
      });
      toast.success('Tarjeta actualizada');
      setIsEditOpen(false);
      fetchCard();
    } catch (error) {
      toast.error('Error al actualizar');
    }
  };

  const openFileViewer = (file) => {
    setSelectedFile(file);
    setIsViewerOpen(true);
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'image': return <Image className="w-6 h-6" />;
      case 'video': return <Video className="w-6 h-6" />;
      default: return <FileText className="w-6 h-6" />;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!card) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-zinc-400">Tarjeta no encontrada</p>
        </div>
      </DashboardLayout>
    );
  }

  const isOwner = card.user_id === user?.user_id;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6" data-testid="card-detail-page">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/cards')}
            className="text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{card.title}</h1>
              <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                card.is_public 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-zinc-700/50 text-zinc-400'
              }`}>
                {card.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {card.is_public ? 'Pública' : 'Privada'}
              </span>
            </div>
            {card.description && (
              <p className="text-zinc-400 mt-1">{card.description}</p>
            )}
          </div>

          {isOwner && (
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(true)}
              className="border-zinc-700 text-zinc-300"
            >
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </Button>
          )}
        </div>

        {/* Google Drive Connection */}
        {isOwner && (
          <Card className="bg-[#18181B] border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    googleConnected ? 'bg-green-500/20' : 'bg-zinc-800'
                  }`}>
                    <svg viewBox="0 0 24 24" className="w-5 h-5">
                      <path fill={googleConnected ? '#22c55e' : '#71717a'} d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-white">Google Drive</p>
                    <p className="text-sm text-zinc-400">
                      {googleConnected ? 'Conectado' : 'No conectado'}
                    </p>
                  </div>
                </div>
                
                {googleConnected ? (
                  <Button
                    variant="outline"
                    onClick={handleDisconnectGoogle}
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    Desconectar
                  </Button>
                ) : (
                  <Button
                    onClick={handleConnectGoogle}
                    className="bg-primary text-white hover:bg-primary/90"
                  >
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Conectar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Section */}
        {isOwner && googleConnected && (
          <Card className="bg-[#18181B] border-zinc-800 border-dashed">
            <CardContent className="p-6">
              <label className="flex flex-col items-center justify-center cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
                {uploading ? (
                  <Loader2 className="w-10 h-10 text-primary animate-spin mb-2" />
                ) : (
                  <Upload className="w-10 h-10 text-zinc-500 mb-2" />
                )}
                <p className="text-zinc-400 text-center">
                  {uploading ? 'Subiendo...' : 'Arrastra archivos o haz clic para subir'}
                </p>
                <p className="text-zinc-600 text-sm mt-1">
                  Imágenes, videos y documentos
                </p>
              </label>
            </CardContent>
          </Card>
        )}

        {/* Files Grid */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Archivos ({card.files?.length || 0})
          </h2>
          
          {(!card.files || card.files.length === 0) ? (
            <Card className="bg-[#18181B] border-zinc-800">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Image className="w-12 h-12 text-zinc-600 mb-4" />
                <p className="text-zinc-400">No hay archivos en esta tarjeta</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {card.files.map((file) => (
                <Card 
                  key={file.file_id} 
                  className="bg-[#18181B] border-zinc-800 hover:border-zinc-700 transition-all overflow-hidden group cursor-pointer"
                  onClick={() => openFileViewer(file)}
                >
                  <div className="aspect-square relative">
                    {file.thumbnail_url ? (
                      <img 
                        src={file.thumbnail_url}
                        alt={file.file_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                        {getFileIcon(file.file_type)}
                      </div>
                    )}
                    
                    {/* Overlay con acciones */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {isOwner && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file.file_id, file.provider_file_id);
                          }}
                          className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Badge de tipo */}
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-1 rounded bg-black/50 text-white text-xs flex items-center gap-1">
                        {getFileIcon(file.file_type)}
                      </span>
                    </div>
                  </div>
                  
                  <CardContent className="p-2">
                    <p className="text-sm text-white truncate">{file.file_name}</p>
                    {file.description && (
                      <p className="text-xs text-zinc-400 truncate">{file.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="bg-[#18181B] border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-white">Editar Tarjeta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateCard} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-zinc-300">Título</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="bg-zinc-900/50 border-zinc-800 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-zinc-300">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-zinc-900/50 border-zinc-800 text-white resize-none"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cover_url" className="text-zinc-300">URL de Portada</Label>
                <Input
                  id="cover_url"
                  value={formData.cover_url}
                  onChange={(e) => setFormData({ ...formData, cover_url: e.target.value })}
                  className="bg-zinc-900/50 border-zinc-800 text-white"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_public"
                  checked={formData.is_public}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
                />
                <Label htmlFor="is_public" className="text-zinc-300">
                  {formData.is_public ? 'Pública' : 'Privada'}
                </Label>
              </div>
              <Button type="submit" className="w-full bg-primary text-white hover:bg-primary/90">
                Guardar Cambios
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* File Viewer Dialog */}
        <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
          <DialogContent className="bg-[#18181B] border-zinc-800 max-w-4xl">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center justify-between">
                {selectedFile?.file_name}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsViewerOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedFile?.file_type === 'image' && (
                <img 
                  src={`${API}/google/download/${selectedFile.provider_file_id}?user_id=${user.user_id}`}
                  alt={selectedFile.file_name}
                  className="w-full max-h-[60vh] object-contain rounded-lg"
                />
              )}
              {selectedFile?.file_type === 'video' && (
                <video 
                  src={`${API}/google/download/${selectedFile.provider_file_id}?user_id=${user.user_id}`}
                  controls
                  className="w-full max-h-[60vh] rounded-lg"
                />
              )}
              {selectedFile?.file_type === 'document' && (
                <div className="flex flex-col items-center py-8">
                  <FileText className="w-16 h-16 text-zinc-500 mb-4" />
                  <p className="text-zinc-400 mb-4">Vista previa no disponible para documentos</p>
                  <a
                    href={`${API}/google/download/${selectedFile.provider_file_id}?user_id=${user.user_id}`}
                    download={selectedFile.file_name}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Download className="w-4 h-4" />
                    Descargar archivo
                  </a>
                </div>
              )}
              {selectedFile?.description && (
                <p className="text-zinc-400">{selectedFile.description}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default CardDetailPage;
