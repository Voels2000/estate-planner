import { createAdminClient } from '../lib/supabase/admin'

async function main() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('income')
    .select('*')
    .eq('owner_id', '854051be-3aac-4d43-8062-df414a7055e1')
  console.log(JSON.stringify(data, null, 2))
  console.log('error:', error)
}
main()
