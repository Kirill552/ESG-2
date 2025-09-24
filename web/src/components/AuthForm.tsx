import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { ArrowLeft, Mail, Key, Fingerprint } from 'lucide-react';
import { Badge } from './ui/badge';

interface AuthFormProps {
  onSuccess: () => void;
  onBack: () => void;
}

export function AuthForm({ onSuccess, onBack }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState<'email' | 'magic' | 'vk' | 'passkey' | null>(null);
  const [hasPasskey] = useState(true); // Симуляция настроенного пасскея

  const handleMagicLink = async () => {
    if (!email) return;
    setIsLoading(true);
    setAuthMethod('magic');
    
    // Симуляция отправки волшебной ссылки
    setTimeout(() => {
      setIsLoading(false);
      onSuccess();
    }, 2000);
  };

  const handleVkAuth = () => {
    setIsLoading(true);
    setAuthMethod('vk');
    
    // Симуляция авторизации через VK ID
    setTimeout(() => {
      setIsLoading(false);
      onSuccess();
    }, 1500);
  };

  const handlePasskeyAuth = () => {
    setIsLoading(true);
    setAuthMethod('passkey');
    
    // Симуляция авторизации через пасскей
    setTimeout(() => {
      setIsLoading(false);
      onSuccess();
    }, 1000);
  };

  if (authMethod === 'magic') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-muted/20">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Проверьте почту</CardTitle>
            <CardDescription>
              Мы отправили ссылку для входа на {email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              onClick={onBack}
              className="w-full"
            >
              Назад
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/20">
      <div className="w-full max-w-md">
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Вход или регистрация</CardTitle>
            <CardDescription>
              Платформа для автоматического создания отчетов
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Email вход */}
            <div className="space-y-3">
              <div>
                <Input
                  type="email"
                  placeholder="Электронная почта"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                />
              </div>
              <Button 
                onClick={handleMagicLink}
                disabled={!email || isLoading}
                className="w-full h-12 bg-[#1dc962] hover:bg-[#19b558] text-white"
              >
                <Mail className="w-5 h-5 mr-3" />
                Продолжить по почте
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              или
            </div>

            {/* Пасскей (если настроен) */}
            {hasPasskey && (
              <Button 
                onClick={handlePasskeyAuth}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 relative"
              >
                <Fingerprint className="w-5 h-5 mr-3" />
                Passkey
              </Button>
            )}

            {/* VK ID */}
            <Button 
              onClick={handleVkAuth}
              disabled={isLoading}
              variant="outline"
              className="w-full h-12 bg-[#0077FF] hover:bg-[#0066CC] text-white border-[#0077FF]"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.714-1.033-1.01-1.49-.715-1.49.357v1.357c0 .357-.115.715-1.357.715-2.17 0-4.55-1.278-6.24-3.618C4.565 11.098 3.94 8.704 3.94 8.182c0-.357.115-.714.595-.714h1.744c.476 0 .66.206.845.69.857 2.284 2.284 4.27 2.88 4.27.22 0 .357-.115.357-.72V9.831c-.082-.99-.594-1.09-.594-1.446 0-.274.22-.55.577-.55h2.747c.396 0 .55.22.55.66v3.58c0 .396.165.55.275.55.22 0 .412-.154.825-.55 1.265-1.376 2.17-3.465 2.17-3.465.137-.274.357-.55.77-.55h1.744c.522 0 .632.275.522.66-.247 1.014-2.637 4.19-2.637 4.19-.192.275-.275.412 0 .715.192.22.825.825 1.237 1.33.715.825 1.265 1.51 1.402 2.006.137.495-.082.77-.577.77z"/>
              </svg>
              Войти с VK ID
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Продолжая, вы соглашаетесь с{' '}
                <a href="#" className="text-[#1dc962] hover:underline">
                  условиями использования
                </a>{' '}
                и{' '}
                <a href="#" className="text-[#1dc962] hover:underline">
                  политикой конфиденциальности
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}