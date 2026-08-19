/* Les couleurs du site, reprises telles quelles : un commerçant qui passe du
   navigateur au téléphone doit reconnaître la même application. */
export const C = {
  fond: '#E3E6E6',
  carte: '#FFFFFF',
  encre: '#0F1111',
  gris: '#565959',
  bord: '#D5D9D9',
  bordClair: '#E7E7E7',
  prix: '#B12704',
  vert: '#007600',
  lien: '#007185',
  jaune: '#FFD814',
  jauneSombre: '#F7CA00',
  ambre: '#B45309',
};

export const S = {
  carte: {
    backgroundColor: C.carte,
    borderRadius: 10,
    padding: 16,
  },
  titre: { fontSize: 17, fontWeight: '700', color: C.encre },
  sousTitre: { fontSize: 13, color: C.gris, lineHeight: 19 },
  etiquette: {
    fontSize: 11, fontWeight: '700', color: C.gris,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  champ: {
    backgroundColor: '#F7FAFA',
    borderWidth: 1, borderColor: C.bord, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: C.encre,
  },
  bouton: {
    backgroundColor: C.jaune, borderRadius: 999,
    paddingVertical: 13, alignItems: 'center',
  },
  boutonTexte: { fontSize: 14, fontWeight: '700', color: C.encre },
  boutonSombre: {
    backgroundColor: C.encre, borderRadius: 10,
    paddingVertical: 13, alignItems: 'center',
  },
  boutonSombreTexte: { fontSize: 14, fontWeight: '700', color: '#FFF' },
};
