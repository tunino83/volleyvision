import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API } from "../api/client";

/**
 * La stella: tieni d'occhio questa squadra, o questa persona.
 *
 * <p>Preferire e un gesto di **chi guarda**, non una proprieta dell'oggetto
 * guardato: una squadra condivisa puo stare fra le preferite di uno e non
 * dell'altro. Per questo la rotta accetta chiunque veda la squadra, e non
 * solo chi la possiede.
 *
 * <p>Si manda lo **stato voluto**, non l'azione. Con due rotte separate
 * (`preferisci`, `dimentica`) il client dovrebbe conoscere lo stato prima di
 * agire, e con due schede aperte sulla stessa squadra finirebbe a chiedere
 * quella sbagliata. Cosi l'ultimo che parla ha ragione.
 */
export function Preferita({ risorsa, id, preferita, chiaviDaAggiornare }: {
  risorsa: "teams" | "persons";
  id: string;
  preferita: boolean;
  /** Le liste che mostrano questo stato e vanno rilette dopo il cambio. */
  chiaviDaAggiornare: string[][];
}) {
  const qc = useQueryClient();

  const cambia = useMutation({
    mutationFn: () => API.put(`/${risorsa}/${id}/preferita`, { preferita: !preferita }),
    onSuccess: () => {
      for (const k of chiaviDaAggiornare) qc.invalidateQueries({ queryKey: k });
    },
  });

  return (
    <button type="button"
            className={`stella ${preferita ? "stella-attiva" : ""}`}
            disabled={cambia.isPending}
            aria-pressed={preferita}
            title={preferita ? "Togli dai preferiti" : "Tieni d'occhio: comparira nella home"}
            onClick={(e) => {
              // La stella sta spesso dentro una scheda che porta al dettaglio:
              // senza questo, premerla aprirebbe anche la pagina.
              e.stopPropagation();
              e.preventDefault();
              cambia.mutate();
            }}>
      <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden
           fill={preferita ? "currentColor" : "none"}
           stroke="currentColor" strokeWidth="1.7"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z" />
      </svg>
    </button>
  );
}
