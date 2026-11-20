import { Song } from "../types/song";

export const SAMPLE_SONGS: Song[] = [
  {
    id: "sample-cielito-lindo",
    title: "Cielito Lindo",
    artist: "Quirino Mendoza (Tradicional)",
    originalKey: "C",
    bpm: 108,
    language: "es",
    source: "sample",
    createdAt: "2026-01-01T00:00:00.000Z",
    sections: [
      {
        id: "cl-intro",
        name: "Intro",
        lines: [
          {
            id: "cl-i1",
            lyrics: "(Rasgueo de vals 3/4 en guitarra acústica)",
            isInstrumental: true,
            chords: [
              { chord: "C", column: 0 },
              { chord: "G7", column: 16 },
              { chord: "C", column: 32 },
            ],
          },
        ],
      },
      {
        id: "cl-v1",
        name: "Verso 1",
        lines: [
          {
            id: "cl-1",
            lyrics: "De la Sierra Morena, cielito lindo, vienen bajando",
            chords: [
              { chord: "C", column: 0 },
              { chord: "G7", column: 29 },
            ],
          },
          {
            id: "cl-2",
            lyrics: "Un par de ojitos negros, cielito lindo, de contrabando",
            chords: [
              { chord: "G7", column: 0 },
              { chord: "C", column: 44 },
            ],
          },
          {
            id: "cl-3",
            lyrics: "Ese lunar que tienes, cielito lindo, junto a la boca",
            chords: [
              { chord: "C", column: 0 },
              { chord: "C7", column: 22 },
              { chord: "F", column: 37 },
            ],
          },
          {
            id: "cl-4",
            lyrics: "No se lo des a nadie, cielito lindo, que a mí me toca",
            chords: [
              { chord: "G7", column: 0 },
              { chord: "C", column: 44 },
            ],
          },
        ],
      },
      {
        id: "cl-coro",
        name: "Coro",
        lines: [
          {
            id: "cl-5",
            lyrics: "Ay, ay, ay, ay, canta y no llores",
            chords: [
              { chord: "F", column: 0 },
              { chord: "G7", column: 16 },
              { chord: "C", column: 28 },
            ],
          },
          {
            id: "cl-6",
            lyrics: "Porque cantando se alegran, cielito lindo, los corazones",
            chords: [
              { chord: "G7", column: 0 },
              { chord: "C", column: 43 },
            ],
          },
          {
            id: "cl-7",
            lyrics: "Ay, ay, ay, ay, canta y no llores",
            chords: [
              { chord: "F", column: 0 },
              { chord: "G7", column: 16 },
              { chord: "C", column: 28 },
            ],
          },
          {
            id: "cl-8",
            lyrics: "Porque cantando se alegran, cielito lindo, los corazones",
            chords: [
              { chord: "G7", column: 0 },
              { chord: "C", column: 43 },
            ],
          },
        ],
      },
      {
        id: "cl-v2",
        name: "Verso 2",
        lines: [
          {
            id: "cl-9",
            lyrics: "Pájaro que abandona, cielito lindo, su primer nido",
            chords: [
              { chord: "C", column: 0 },
              { chord: "G7", column: 29 },
            ],
          },
          {
            id: "cl-10",
            lyrics: "Si lo encuentra ocupado, cielito lindo, bien merecido",
            chords: [
              { chord: "G7", column: 0 },
              { chord: "C", column: 44 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "sample-la-bamba",
    title: "La Bamba",
    artist: "Son Jarocho Tradicional",
    originalKey: "C",
    bpm: 142,
    language: "es",
    source: "sample",
    createdAt: "2026-01-02T00:00:00.000Z",
    sections: [
      {
        id: "lb-intro",
        name: "Intro (Riff)",
        lines: [
          {
            id: "lb-i1",
            lyrics: "(Riff principal x4 — C F G)",
            isInstrumental: true,
            chords: [
              { chord: "C", column: 0 },
              { chord: "F", column: 12 },
              { chord: "G", column: 22 },
            ],
          },
        ],
      },
      {
        id: "lb-v1",
        name: "Verso 1",
        lines: [
          {
            id: "lb-1",
            lyrics: "Para bailar la bamba, para bailar la bamba se necesita",
            chords: [
              { chord: "C", column: 0 },
              { chord: "F", column: 15 },
              { chord: "G", column: 27 },
              { chord: "C", column: 42 },
            ],
          },
          {
            id: "lb-2",
            lyrics: "Una poca de gracia, una poca de gracia pa mí pa ti",
            chords: [
              { chord: "F", column: 0 },
              { chord: "G", column: 14 },
              { chord: "C", column: 28 },
              { chord: "F", column: 41 },
            ],
          },
          {
            id: "lb-3",
            lyrics: "Y arriba y arriba, arriba y arriba, por ti seré",
            chords: [
              { chord: "G", column: 0 },
              { chord: "C", column: 18 },
              { chord: "F", column: 30 },
              { chord: "G", column: 42 },
            ],
          },
          {
            id: "lb-4",
            lyrics: "Por ti seré, por ti seré",
            chords: [
              { chord: "C", column: 0 },
              { chord: "F", column: 13 },
              { chord: "G", column: 21 },
            ],
          },
        ],
      },
      {
        id: "lb-coro",
        name: "Coro",
        lines: [
          {
            id: "lb-5",
            lyrics: "Yo no soy marinero, yo no soy marinero, soy capitán",
            chords: [
              { chord: "C", column: 0 },
              { chord: "F", column: 14 },
              { chord: "G", column: 30 },
              { chord: "C", column: 42 },
            ],
          },
          {
            id: "lb-6",
            lyrics: "Soy capitán, soy capitán",
            chords: [
              { chord: "F", column: 0 },
              { chord: "G", column: 13 },
              { chord: "C", column: 21 },
            ],
          },
          {
            id: "lb-7",
            lyrics: "Bamba, bamba, bamba, bamba",
            chords: [
              { chord: "C", column: 0 },
              { chord: "F", column: 12 },
              { chord: "G", column: 20 },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "sample-la-llorona",
    title: "La Llorona",
    artist: "Tradicional Oaxaqueña",
    originalKey: "Am",
    bpm: 84,
    language: "es",
    source: "sample",
    createdAt: "2026-01-03T00:00:00.000Z",
    sections: [
      {
        id: "ll-intro",
        name: "Intro",
        lines: [
          {
            id: "ll-i1",
            lyrics: "(Arpegio lento 3/4 — Am Dm G C E7)",
            isInstrumental: true,
            chords: [
              { chord: "Am", column: 0 },
              { chord: "Dm", column: 12 },
              { chord: "E7", column: 26 },
            ],
          },
        ],
      },
      {
        id: "ll-v1",
        name: "Verso 1",
        lines: [
          {
            id: "ll-1",
            lyrics: "Todos me dicen el negro, llorona, negro pero cariñoso",
            chords: [
              { chord: "Am", column: 0 },
              { chord: "Dm", column: 20 },
              { chord: "E7", column: 42 },
            ],
          },
          {
            id: "ll-2",
            lyrics: "Yo soy como el chile verde, llorona, picante pero sabroso",
            chords: [
              { chord: "Am", column: 0 },
              { chord: "Dm", column: 21 },
              { chord: "E7", column: 45 },
              { chord: "Am", column: 55 },
            ],
          },
        ],
      },
      {
        id: "ll-coro",
        name: "Coro",
        lines: [
          {
            id: "ll-3",
            lyrics: "Ay de mí, llorona, llorona, llorona de azul celeste",
            chords: [
              { chord: "Am", column: 0 },
              { chord: "G", column: 19 },
              { chord: "F", column: 30 },
              { chord: "E7", column: 45 },
            ],
          },
          {
            id: "ll-4",
            lyrics: "Y aunque la vida me cueste, llorona, no dejaré de quererte",
            chords: [
              { chord: "Dm", column: 0 },
              { chord: "Am", column: 23 },
              { chord: "E7", column: 42 },
              { chord: "Am", column: 56 },
            ],
          },
        ],
      },
      {
        id: "ll-v2",
        name: "Verso 2",
        lines: [
          {
            id: "ll-5",
            lyrics: "Salías del templo un día, llorona, cuando al pasar yo te vi",
            chords: [
              { chord: "Am", column: 0 },
              { chord: "Dm", column: 22 },
              { chord: "E7", column: 44 },
              { chord: "Am", column: 56 },
            ],
          },
          {
            id: "ll-6",
            lyrics: "Hermoso huipil llevabas, llorona, que la virgen te creí",
            chords: [
              { chord: "Am", column: 0 },
              { chord: "Dm", column: 21 },
              { chord: "E7", column: 42 },
              { chord: "Am", column: 54 },
            ],
          },
        ],
      },
    ],
  },
];
