import { Button } from '@futzone/ui';
import React from 'react';

export function UsernameSuggestions({ suggestions, onSelect }: { suggestions: string[]; onSelect: (username: string) => void }) {
  return <div className="flex flex-wrap gap-2">{suggestions.map((suggestion) => <Button key={suggestion} type="button" size="sm" variant="outline" onClick={() => onSelect(suggestion)}>{suggestion}</Button>)}</div>;
}
